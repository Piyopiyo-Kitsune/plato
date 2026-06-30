<?php
/**
 * Publish WordPress lessons into Plato content.
 *
 * Composes the Plato lesson markdown from a coaching lesson and pushes it (with
 * its course association) to Plato via the signed bridge. The course link is the
 * load-bearing piece for per-learner, course-scoped cross-lesson memory.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Sync module.
 */
class Agentic_Coach_Sync {

	/**
	 * Plato client.
	 *
	 * @var Agentic_Coach_Plato_Client
	 */
	private $plato;

	/**
	 * Constructor.
	 *
	 * @param Agentic_Coach_Plato_Client $plato Plato client.
	 */
	public function __construct( Agentic_Coach_Plato_Client $plato ) {
		$this->plato = $plato;
	}

	/**
	 * Register the publish REST route.
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
			Agentic_Coach_REST::NS,
			'/publish-lesson',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'publish' ),
				'permission_callback' => array( $this, 'can_publish' ),
				'args'                => array(
					'postId' => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Permission: can edit the specific lesson post.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool
	 */
	public function can_publish( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'postId' );
		return $post_id > 0 && current_user_can( 'edit_post', $post_id );
	}

	/**
	 * Publish a lesson to Plato and store the returned mapping.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function publish( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'postId' );
		$post    = get_post( $post_id );
		if ( ! $post || Agentic_Coach_Content_Types::LESSON !== $post->post_type ) {
			return new WP_Error( 'agentic_coach_not_lesson', __( 'Not a coaching lesson.', 'agentic-coach' ), array( 'status' => 400 ) );
		}

		$plato_lesson_id = $this->plato->content_id( 'l', $post_id );

		$course_post_id = (int) get_post_meta( $post_id, '_agentic_course', true );
		$course_id      = '';
		$course_name    = '';
		if ( $course_post_id ) {
			$course_id   = $this->plato->content_id( 'c', $course_post_id );
			$course_name = get_the_title( $course_post_id );
		}

		$result = $this->plato->publish_lesson(
			array(
				'plato_lesson_id' => $plato_lesson_id,
				'name'            => $post->post_title,
				'markdown'        => $this->compose_markdown( $post ),
				'status'          => 'publish' === $post->post_status ? 'public' : 'draft',
				'course_id'       => $course_id,
				'course_name'     => $course_name,
			)
		);

		if ( is_wp_error( $result ) ) {
			return new WP_Error( $result->get_error_code(), $result->get_error_message(), array( 'status' => 502 ) );
		}

		update_post_meta( $post_id, '_plato_lesson_id', $plato_lesson_id );
		if ( $course_id ) {
			update_post_meta( $post_id, '_plato_course_id', $course_id );
		}

		return rest_ensure_response(
			array(
				'platoLessonId' => $plato_lesson_id,
				'platoCourseId' => $course_id,
				'courseLinked'  => '' !== $course_id,
			)
		);
	}

	/**
	 * Compose Plato lesson markdown from a coaching lesson post.
	 *
	 * Produces the structure Plato parses: title, a description line, a
	 * "Learning Objectives" bullet list, an "Exemplar" section, and an optional
	 * "Coach Directive" section.
	 *
	 * @param WP_Post $post Lesson post.
	 * @return string
	 */
	public function compose_markdown( WP_Post $post ) {
		$description = trim( wp_strip_all_tags( $post->post_content ) );
		$description = '' !== $description ? explode( "\n", $description )[0] : '';

		$objectives_raw = (string) get_post_meta( $post->ID, '_agentic_objectives', true );
		$objectives     = array();
		foreach ( preg_split( '/\r\n|\r|\n/', $objectives_raw ) as $line ) {
			$line = trim( preg_replace( '/^[-*]\s+/', '', $line ) );
			if ( '' !== $line ) {
				$objectives[] = $line;
			}
		}

		$exemplar  = trim( (string) get_post_meta( $post->ID, '_agentic_exemplar', true ) );
		$directive = trim( (string) get_post_meta( $post->ID, '_agentic_coach_directive', true ) );

		$md = '# ' . $post->post_title . "\n";
		if ( '' !== $description ) {
			$md .= $description . "\n";
		}
		$md .= "\n## Learning Objectives\n";
		foreach ( $objectives as $objective ) {
			$md .= '- ' . $objective . "\n";
		}
		if ( '' !== $exemplar ) {
			$md .= "\n## Exemplar\n" . $exemplar . "\n";
		}
		if ( '' !== $directive ) {
			$md .= "\n## Coach Directive\n" . $directive . "\n";
		}

		return $md;
	}
}
