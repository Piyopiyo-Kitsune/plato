<?php
/**
 * Sensei LMS integration.
 *
 * Maps Sensei courses/lessons onto Plato so the agentic coach's per-learner,
 * course-scoped memory follows Sensei's structure: every Sensei lesson publishes
 * to Plato under its Sensei course (via `_lesson_course`), so lessons in the same
 * Sensei course share one Plato course — and memory never crosses courses.
 *
 * Active only when Sensei LMS is present; otherwise every method is inert.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Sensei integration module.
 */
class Agentic_Coach_Sensei {

	const COURSE      = 'course';          // Sensei course CPT.
	const LESSON      = 'lesson';          // Sensei lesson CPT.
	const COURSE_META = '_lesson_course';  // Sensei lesson → course post id.

	/**
	 * Whether Sensei LMS is active.
	 *
	 * @return bool
	 */
	public static function is_active() {
		return defined( 'SENSEI_LMS_VERSION' ) || class_exists( 'Sensei_Main' );
	}

	/**
	 * Register hooks (no-op when Sensei is absent).
	 *
	 * @return void
	 */
	public function register() {
		if ( ! self::is_active() ) {
			return;
		}
		add_action( 'init', array( $this, 'register_meta' ) );
		add_action( 'sensei_single_lesson_content_inside_after', array( $this, 'render_coach' ) );
	}

	/**
	 * Register coaching + Plato-mapping meta on the Sensei lesson CPT so the
	 * authoring sidebar can edit it and the publish flow can read it.
	 *
	 * @return void
	 */
	public function register_meta() {
		$auth = function () {
			return current_user_can( 'edit_posts' );
		};

		foreach ( array( '_agentic_excerpt', '_agentic_objectives', '_agentic_exemplar', '_agentic_coach_directive' ) as $key ) {
			register_post_meta(
				self::LESSON,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_textarea_field',
					'auth_callback'     => $auth,
				)
			);
		}
		foreach ( array( '_plato_lesson_id', '_plato_course_id' ) as $key ) {
			register_post_meta(
				self::LESSON,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_text_field',
					'auth_callback'     => $auth,
				)
			);
		}
	}

	/**
	 * Resolve a Sensei lesson's module name/order and its order within the
	 * module, for the course-detail view (lessons grouped under a module
	 * header, in order). Returns nulls when the lesson has no module.
	 *
	 * Sensei stores: the lesson's module as the `module` taxonomy term; the
	 * course's module display order as course meta `module_order` (an array of
	 * term ids); and a lesson's order within its module as lesson meta
	 * `_order_module_<module_id>`.
	 *
	 * @param int $lesson_id      Sensei lesson post id.
	 * @param int $course_post_id Sensei course post id (0 if none).
	 * @return array { name: string|null, module_order: int|null, lesson_order: int|null }
	 */
	public static function lesson_module_info( $lesson_id, $course_post_id ) {
		$none = array( 'name' => null, 'module_order' => null, 'lesson_order' => null );
		if ( ! self::is_active() ) {
			return $none;
		}

		$terms = wp_get_post_terms( $lesson_id, 'module' );
		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return $none;
		}
		$module = $terms[0];

		$module_order = null;
		if ( $course_post_id ) {
			$order = get_post_meta( $course_post_id, 'module_order', true );
			if ( is_array( $order ) ) {
				$position = array_search( (string) $module->term_id, array_map( 'strval', $order ), true );
				if ( false !== $position ) {
					$module_order = (int) $position;
				}
			}
		}

		$lesson_order = get_post_meta( $lesson_id, '_order_module_' . $module->term_id, true );

		return array(
			'name'         => $module->name,
			'module_order' => $module_order,
			'lesson_order' => '' !== $lesson_order ? (int) $lesson_order : null,
		);
	}

	/**
	 * Render the embedded coach after a Sensei lesson's content, once the lesson
	 * has been published to Plato.
	 *
	 * @return void
	 */
	public function render_coach() {
		$post_id = get_the_ID();
		if ( ! $post_id ) {
			return;
		}
		$plato_lesson_id = (string) get_post_meta( $post_id, '_plato_lesson_id', true );
		$settings        = Agentic_Coach::instance()->settings;
		if ( '' === $plato_lesson_id || ! $settings->is_configured() || ! is_user_logged_in() ) {
			return;
		}

		Agentic_Coach_Embed::enqueue_assets();
		$title = sprintf(
			/* translators: %s: lesson title. */
			__( 'WordPress coaching for %s', 'agentic-coach' ),
			get_the_title( $post_id )
		);
		echo '<section class="agentic-coach agentic-coach--sensei" aria-label="' . esc_attr__( 'Coaching', 'agentic-coach' ) . '">';
		echo '<h2 class="agentic-coach__heading">' . esc_html__( 'Practice with your coach', 'agentic-coach' ) . '</h2>';
		echo wp_kses( Agentic_Coach_Embed::mount_html( $settings, $plato_lesson_id, $title ), Agentic_Coach_Block::mount_kses() );
		echo '</section>';
	}
}
