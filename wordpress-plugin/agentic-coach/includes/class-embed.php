<?php
/**
 * Shared coach embed markup + asset enqueueing.
 *
 * Used by both the WordPress Coach block and the Sensei LMS integration so the
 * learner-facing iframe mount is rendered identically everywhere.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Embed helper.
 */
class Agentic_Coach_Embed {

	/**
	 * Enqueue the front-end view script + style (registered by the block).
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		wp_enqueue_script( Agentic_Coach_Block::VIEW_HANDLE );
		wp_enqueue_style( Agentic_Coach_Block::STYLE_HANDLE );
	}

	/**
	 * Build the interactive mount markup consumed by view.js.
	 *
	 * @param Agentic_Coach_Settings $settings        Settings.
	 * @param string                 $plato_lesson_id Plato lesson id.
	 * @param string                 $frame_title     Accessible iframe title.
	 * @return string
	 */
	public static function mount_html( Agentic_Coach_Settings $settings, $plato_lesson_id, $frame_title ) {
		ob_start();
		?>
		<div
			class="agentic-coach__mount"
			data-plato-url="<?php echo esc_attr( $settings->plato_url() ); ?>"
			data-lesson="<?php echo esc_attr( $plato_lesson_id ); ?>"
			data-endpoint="<?php echo esc_url( rest_url( Agentic_Coach_REST::NS . '/embed-token' ) ); ?>"
			data-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>"
			data-frame-title="<?php echo esc_attr( $frame_title ); ?>"
		>
			<div class="agentic-coach__status" role="status" aria-live="polite">
				<?php esc_html_e( 'Loading your coach…', 'agentic-coach' ); ?>
			</div>
			<noscript><?php esc_html_e( 'JavaScript is required to use the WordPress Coach.', 'agentic-coach' ); ?></noscript>
		</div>
		<?php
		return (string) ob_get_clean();
	}
}
