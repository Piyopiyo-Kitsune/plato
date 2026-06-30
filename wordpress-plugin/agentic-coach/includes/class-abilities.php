<?php
/**
 * WordPress Abilities API registrations.
 *
 * Exposes course/lesson/context/embed-token operations as typed abilities with
 * native capability enforcement. Available on WordPress 7.0+ (or with the
 * Abilities API feature plugin); a no-op otherwise. The plugin's REST routes
 * provide the same capabilities for older sites.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Abilities module.
 */
class Agentic_Coach_Abilities {

	/**
	 * Settings module.
	 *
	 * @var Agentic_Coach_Settings
	 */
	private $settings;

	/**
	 * Plato client.
	 *
	 * @var Agentic_Coach_Plato_Client
	 */
	private $plato;

	/**
	 * Constructor.
	 *
	 * @param Agentic_Coach_Settings     $settings Settings module.
	 * @param Agentic_Coach_Plato_Client $plato    Plato client.
	 */
	public function __construct( Agentic_Coach_Settings $settings, Agentic_Coach_Plato_Client $plato ) {
		$this->settings = $settings;
		$this->plato    = $plato;
	}

	/**
	 * Register on the Abilities API init hook, with a defensive fallback.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'abilities_api_init', array( $this, 'register_abilities' ) );
		add_action(
			'init',
			function () {
				if ( ! did_action( 'abilities_api_init' ) && function_exists( 'wp_register_ability' ) ) {
					$this->register_abilities();
				}
			},
			20
		);
	}

	/**
	 * Register all abilities.
	 *
	 * @return void
	 */
	public function register_abilities() {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		$author   = function () {
			return current_user_can( 'edit_posts' );
		};
		$learner  = function () {
			return is_user_logged_in();
		};
		$mcp_meta = array( 'mcp' => array( 'public' => false ) );

		wp_register_ability(
			'agentic-coach/list-courses',
			array(
				'label'               => __( 'List coaching courses', 'agentic-coach' ),
				'description'         => __( 'Returns Agentic Coach courses on this site.', 'agentic-coach' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(),
				),
				'output_schema'       => array( 'type' => 'array' ),
				'permission_callback' => $author,
				'execute_callback'    => array( $this, 'ability_list_courses' ),
				'meta'                => $mcp_meta,
			)
		);

		wp_register_ability(
			'agentic-coach/get-lesson-context',
			array(
				'label'               => __( 'Get lesson context', 'agentic-coach' ),
				'description'         => __( 'Returns the markdown, objectives, exemplar, coach directive, and course/module for a lesson — for Plato to read over MCP.', 'agentic-coach' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array( 'lessonId' => array( 'type' => 'integer' ) ),
					'required'   => array( 'lessonId' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'permission_callback' => $author,
				'execute_callback'    => array( $this, 'ability_lesson_context' ),
				'meta'                => $mcp_meta,
			)
		);

		wp_register_ability(
			'agentic-coach/get-embed-token',
			array(
				'label'               => __( 'Get coach embed token', 'agentic-coach' ),
				'description'         => __( 'Mints a single-use embed URL for the current learner.', 'agentic-coach' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array( 'lessonId' => array( 'type' => 'string' ) ),
					'required'   => array( 'lessonId' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'permission_callback' => $learner,
				'execute_callback'    => array( $this, 'ability_embed_token' ),
				'meta'                => $mcp_meta,
			)
		);
	}

	/**
	 * Ability: list courses.
	 *
	 * @return array
	 */
	public function ability_list_courses() {
		$courses = get_posts(
			array(
				'post_type'   => Agentic_Coach_Content_Types::COURSE,
				'post_status' => array( 'publish', 'draft' ),
				'numberposts' => 100,
			)
		);
		return array_map(
			function ( $course ) {
				return array(
					'id'          => $course->ID,
					'title'       => $course->post_title,
					'platoCourse' => (string) get_post_meta( $course->ID, '_plato_course_id', true ),
				);
			},
			$courses
		);
	}

	/**
	 * Ability: lesson context for the coach.
	 *
	 * @param array $input Input with lessonId.
	 * @return array
	 */
	public function ability_lesson_context( $input ) {
		$lesson_id = isset( $input['lessonId'] ) ? (int) $input['lessonId'] : 0;
		$lesson    = $lesson_id ? get_post( $lesson_id ) : null;
		if ( ! $lesson || Agentic_Coach_Content_Types::LESSON !== $lesson->post_type ) {
			return array( 'error' => 'not_found' );
		}
		$course_id = (int) get_post_meta( $lesson_id, '_agentic_course', true );
		return array(
			'id'             => $lesson_id,
			'title'          => $lesson->post_title,
			'markdown'       => $lesson->post_content,
			'objectives'     => (string) get_post_meta( $lesson_id, '_agentic_objectives', true ),
			'exemplar'       => (string) get_post_meta( $lesson_id, '_agentic_exemplar', true ),
			'coachDirective' => (string) get_post_meta( $lesson_id, '_agentic_coach_directive', true ),
			'platoLessonId'  => (string) get_post_meta( $lesson_id, '_plato_lesson_id', true ),
			'course'         => $course_id ? array(
				'id'    => $course_id,
				'title' => get_the_title( $course_id ),
				'plato' => (string) get_post_meta( $course_id, '_plato_course_id', true ),
			) : null,
		);
	}

	/**
	 * Ability: mint an embed token for the current learner.
	 *
	 * @param array $input Input with lessonId (Plato lesson id).
	 * @return array|WP_Error
	 */
	public function ability_embed_token( $input ) {
		$lesson_id = isset( $input['lessonId'] ) ? (string) $input['lessonId'] : '';
		$result    = $this->plato->mint_embed_code( $lesson_id, get_current_user_id() );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array( 'embedUrl' => $this->plato->embed_url( $result['lessonId'] ?? $lesson_id, $result['code'] ) );
	}
}
