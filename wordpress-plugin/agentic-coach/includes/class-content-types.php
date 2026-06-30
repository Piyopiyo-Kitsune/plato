<?php
/**
 * Custom post types: courses, modules, lessons, and their relationships.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Content types module.
 */
class Agentic_Coach_Content_Types {

	const COURSE = 'agentic_course';
	const MODULE = 'agentic_module';
	const LESSON = 'agentic_lesson';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_post_types' ) );
		add_action( 'init', array( $this, 'register_meta' ) );
	}

	/**
	 * Register the three post types.
	 *
	 * @return void
	 */
	public function register_post_types() {
		register_post_type(
			self::COURSE,
			$this->args( __( 'Coaching Courses', 'agentic-coach' ), __( 'Coaching Course', 'agentic-coach' ), 'dashicons-welcome-learn-more' )
		);
		register_post_type(
			self::MODULE,
			$this->args( __( 'Coaching Modules', 'agentic-coach' ), __( 'Coaching Module', 'agentic-coach' ), 'dashicons-category' )
		);
		register_post_type(
			self::LESSON,
			$this->args( __( 'Coaching Lessons', 'agentic-coach' ), __( 'Coaching Lesson', 'agentic-coach' ), 'dashicons-book' )
		);
	}

	/**
	 * Shared CPT args.
	 *
	 * @param string $plural   Plural label.
	 * @param string $singular Singular label.
	 * @param string $icon     Dashicon.
	 * @return array
	 */
	private function args( $plural, $singular, $icon ) {
		return array(
			'labels'          => array(
				'name'          => $plural,
				'singular_name' => $singular,
				'add_new_item'  => sprintf( /* translators: %s: singular label. */ __( 'Add New %s', 'agentic-coach' ), $singular ),
				'edit_item'     => sprintf( /* translators: %s: singular label. */ __( 'Edit %s', 'agentic-coach' ), $singular ),
			),
			'public'          => false,
			'show_ui'         => true,
			'show_in_menu'    => true,
			'show_in_rest'    => true,
			'menu_icon'       => $icon,
			'supports'        => array( 'title', 'editor', 'custom-fields' ),
			'capability_type' => 'post',
			'map_meta_cap'    => true,
		);
	}

	/**
	 * Register relationship + Plato-mapping meta.
	 *
	 * @return void
	 */
	public function register_meta() {
		$auth = function () {
			return current_user_can( 'edit_posts' );
		};

		$string_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_text_field',
					'auth_callback'     => $auth,
				)
			);
		};

		$int_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'integer',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'absint',
					'auth_callback'     => $auth,
				)
			);
		};

		// Multi-line fields (objectives, exemplar, coach directive) must preserve
		// newlines — sanitize_text_field collapses them, which would flatten the
		// objectives list into a single bullet.
		$text_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_textarea_field',
					'auth_callback'     => $auth,
				)
			);
		};

		// Lesson → course/module relationships + ordering, plus Plato ids.
		$int_meta( self::LESSON, '_agentic_course' );
		$int_meta( self::LESSON, '_agentic_module' );
		$int_meta( self::LESSON, '_agentic_order' );
		$string_meta( self::LESSON, '_plato_lesson_id' );
		$string_meta( self::LESSON, '_plato_course_id' );
		$text_meta( self::LESSON, '_agentic_exemplar' );
		$text_meta( self::LESSON, '_agentic_objectives' );
		$text_meta( self::LESSON, '_agentic_coach_directive' );

		// Module → course relationship + ordering.
		$int_meta( self::MODULE, '_agentic_course' );
		$int_meta( self::MODULE, '_agentic_order' );

		// Course → Plato course id.
		$string_meta( self::COURSE, '_plato_course_id' );
	}
}
