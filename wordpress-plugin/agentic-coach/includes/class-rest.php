<?php
/**
 * REST API: embed-token minting, editor data, and author coaching.
 *
 * These routes are always available (they don't require WP 7.0). The Abilities
 * API / MCP registrations layer on top when present.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * REST module.
 */
class Agentic_Coach_REST {

	const NS = 'agentic-coach/v1';

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
	 * Register routes.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	/**
	 * Define routes.
	 *
	 * @return void
	 */
	public function routes() {
		register_rest_route(
			self::NS,
			'/embed-token',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'embed_token' ),
				'permission_callback' => array( $this, 'can_learn' ),
				'args'                => array(
					'lessonId' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/courses',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_courses' ),
				'permission_callback' => array( $this, 'can_author' ),
			)
		);

		register_rest_route(
			self::NS,
			'/modules',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_modules' ),
				'permission_callback' => array( $this, 'can_author' ),
				'args'                => array(
					'course' => array(
						'required'          => false,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/courses/(?P<id>\d+)/lessons',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_course_lessons' ),
				'permission_callback' => array( $this, 'can_author' ),
				'args'                => array(
					'id' => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/author-coach',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'author_coach' ),
				'permission_callback' => array( $this, 'can_author' ),
				'args'                => array(
					'prompt' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_textarea_field',
					),
				),
			)
		);
	}

	/**
	 * Permission: any logged-in learner.
	 *
	 * @return bool
	 */
	public function can_learn() {
		return is_user_logged_in();
	}

	/**
	 * Permission: content authors.
	 *
	 * @return bool
	 */
	public function can_author() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * POST /embed-token — mint a single-use embed URL for the current learner.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function embed_token( WP_REST_Request $request ) {
		$lesson_id = $request->get_param( 'lessonId' );
		// An empty lessonId means the "courses home" embed — mint a code with no
		// lesson bound and build the full-app home URL.
		$is_home   = ( '' === $lesson_id || null === $lesson_id || '0' === (string) $lesson_id );
		$result    = $this->plato->mint_embed_code( $is_home ? null : $lesson_id, get_current_user_id() );
		if ( is_wp_error( $result ) ) {
			return new WP_Error(
				$result->get_error_code(),
				$result->get_error_message(),
				array( 'status' => 502 )
			);
		}
		$embed_url = $is_home
			? $this->plato->home_embed_url( $result['code'] )
			: $this->plato->embed_url( $result['lessonId'] ?? $lesson_id, $result['code'] );
		return rest_ensure_response( array( 'embedUrl' => $embed_url ) );
	}

	/**
	 * GET /courses — id + title for the editor selector.
	 *
	 * @return WP_REST_Response
	 */
	public function list_courses() {
		$courses = get_posts(
			array(
				'post_type'   => Agentic_Coach_Content_Types::COURSE,
				'post_status' => array( 'publish', 'draft' ),
				'numberposts' => 100,
				'orderby'     => 'title',
				'order'       => 'ASC',
			)
		);
		$out     = array();
		foreach ( $courses as $course ) {
			$out[] = array(
				'id'          => $course->ID,
				'title'       => $course->post_title,
				'platoCourse' => (string) get_post_meta( $course->ID, '_plato_course_id', true ),
			);
		}
		return rest_ensure_response( $out );
	}

	/**
	 * GET /modules — modules for the editor selector, optionally filtered by course.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function list_modules( WP_REST_Request $request ) {
		$course = (int) $request->get_param( 'course' );
		$args   = array(
			'post_type'   => Agentic_Coach_Content_Types::MODULE,
			'post_status' => array( 'publish', 'draft' ),
			'numberposts' => 100,
			'orderby'     => 'title',
			'order'       => 'ASC',
		);
		if ( $course ) {
			$args['meta_key']   = '_agentic_course'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- bounded authoring query.
			$args['meta_value'] = $course; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- bounded authoring query.
		}
		$modules = get_posts( $args );
		$out     = array();
		foreach ( $modules as $module ) {
			$out[] = array(
				'id'       => $module->ID,
				'title'    => $module->post_title,
				'courseId' => (int) get_post_meta( $module->ID, '_agentic_course', true ),
				'order'    => (int) get_post_meta( $module->ID, '_agentic_order', true ),
			);
		}
		return rest_ensure_response( $out );
	}

	/**
	 * GET /courses/{id}/lessons — module-grouped, ordered lessons for a course.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function list_course_lessons( WP_REST_Request $request ) {
		$course_id = (int) $request->get_param( 'id' );
		$lessons   = get_posts(
			array(
				'post_type'   => Agentic_Coach_Content_Types::LESSON,
				'post_status' => array( 'publish', 'draft' ),
				'numberposts' => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_numberposts -- all lessons in one course, bounded authoring query.
				'meta_key'    => '_agentic_course', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- bounded admin query.
				'meta_value'  => $course_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- bounded admin query.
			)
		);

		$out = array();
		foreach ( $lessons as $lesson ) {
			$out[] = array(
				'id'          => $lesson->ID,
				'title'       => $lesson->post_title,
				'moduleId'    => (int) get_post_meta( $lesson->ID, '_agentic_module', true ),
				'order'       => (int) get_post_meta( $lesson->ID, '_agentic_order', true ),
				'platoLesson' => (string) get_post_meta( $lesson->ID, '_plato_lesson_id', true ),
			);
		}

		usort(
			$out,
			function ( $a, $b ) {
				return $a['order'] <=> $b['order'];
			}
		);

		return rest_ensure_response( $out );
	}

	/**
	 * POST /author-coach — lightweight in-editor AI assist via WordPress's
	 * native PHP AI Client (WP 7.0+). Used for rewrite/summarize/idea help; the
	 * full agentic coach lives in Plato.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function author_coach( WP_REST_Request $request ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'agentic_coach_no_ai_client',
				__( 'This site does not have the WordPress AI Client available (requires WordPress 7.0+).', 'agentic-coach' ),
				array( 'status' => 501 )
			);
		}

		$prompt = (string) $request->get_param( 'prompt' );
		$result = wp_ai_client_prompt( $prompt );

		if ( is_wp_error( $result ) ) {
			return new WP_Error( $result->get_error_code(), $result->get_error_message(), array( 'status' => 502 ) );
		}

		return rest_ensure_response( array( 'text' => is_string( $result ) ? $result : wp_json_encode( $result ) ) );
	}
}
