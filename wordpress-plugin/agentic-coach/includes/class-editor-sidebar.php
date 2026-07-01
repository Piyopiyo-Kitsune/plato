<?php
/**
 * Gutenberg authoring sidebar for coaching lessons.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Editor sidebar module.
 */
class Agentic_Coach_Editor_Sidebar {

	const HANDLE           = 'agentic-coach-editor-sidebar';
	const PLACEMENT_HANDLE = 'agentic-coach-placement-panel';
	const CONTENT_HANDLE   = 'agentic-coach-content-panel';

	/**
	 * Settings module.
	 *
	 * @var Agentic_Coach_Settings
	 */
	private $settings;

	/**
	 * Constructor.
	 *
	 * @param Agentic_Coach_Settings $settings Settings module.
	 */
	public function __construct( Agentic_Coach_Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue' ) );
	}

	/**
	 * Enqueue the sidebar only on the lesson editor.
	 *
	 * @return void
	 */
	public function enqueue() {
		$screen    = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$post_type = $screen ? $screen->post_type : '';

		// Placement panel (course/module/order) on module + lesson editors.
		if ( Agentic_Coach_Content_Types::MODULE === $post_type || Agentic_Coach_Content_Types::LESSON === $post_type ) {
			wp_enqueue_script(
				self::PLACEMENT_HANDLE,
				AGENTIC_COACH_PLUGIN_URL . 'assets/relationship-panel.js',
				array( 'wp-plugins', 'wp-editor', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-core-data', 'wp-i18n', 'wp-api-fetch' ),
				AGENTIC_COACH_VERSION,
				true
			);
			wp_set_script_translations( self::PLACEMENT_HANDLE, 'agentic-coach' );
		}

		// Coaching content + Publish-to-Plato: our lessons and (when Sensei is
		// active) Sensei lessons, which map to Plato via their course.
		$is_our_lesson    = Agentic_Coach_Content_Types::LESSON === $post_type;
		$is_sensei_lesson = Agentic_Coach_Sensei::LESSON === $post_type && Agentic_Coach_Sensei::is_active();
		if ( $is_our_lesson || $is_sensei_lesson ) {
			// "Coaching content" document panel: objectives, exemplar, coach directive.
			wp_enqueue_script(
				self::CONTENT_HANDLE,
				AGENTIC_COACH_PLUGIN_URL . 'assets/coaching-panel.js',
				array( 'wp-plugins', 'wp-editor', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-core-data', 'wp-i18n' ),
				AGENTIC_COACH_VERSION,
				true
			);
			wp_set_script_translations( self::CONTENT_HANDLE, 'agentic-coach' );

			wp_enqueue_script(
				self::HANDLE,
				AGENTIC_COACH_PLUGIN_URL . 'assets/editor-sidebar.js',
				array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-i18n', 'wp-api-fetch' ),
				AGENTIC_COACH_VERSION,
				true
			);
			wp_set_script_translations( self::HANDLE, 'agentic-coach' );
		}
	}
}
