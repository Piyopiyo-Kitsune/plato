<?php
/**
 * The learner-facing "WordPress Coach" dynamic block.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Block module.
 */
class Agentic_Coach_Block {

	const EDITOR_HANDLE = 'agentic-coach-lesson-coach-editor';
	const VIEW_HANDLE   = 'agentic-coach-lesson-coach-view';
	const STYLE_HANDLE  = 'agentic-coach-lesson-coach-style';
	const EDITOR_STYLE  = 'agentic-coach-lesson-coach-editor-style';

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
	 * Register the block.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_block' ) );
	}

	/**
	 * Register assets + the block type with a PHP render callback.
	 *
	 * @return void
	 */
	public function register_block() {
		$base = AGENTIC_COACH_PLUGIN_URL . 'blocks/lesson-coach/';

		wp_register_script(
			self::EDITOR_HANDLE,
			$base . 'index.js',
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'wp-api-fetch' ),
			AGENTIC_COACH_VERSION,
			true
		);
		wp_set_script_translations( self::EDITOR_HANDLE, 'agentic-coach' );

		wp_register_script(
			self::VIEW_HANDLE,
			$base . 'view.js',
			array(),
			AGENTIC_COACH_VERSION,
			true
		);

		wp_register_style( self::STYLE_HANDLE, $base . 'style.css', array(), AGENTIC_COACH_VERSION );
		wp_register_style( self::EDITOR_STYLE, $base . 'editor.css', array(), AGENTIC_COACH_VERSION );

		register_block_type(
			AGENTIC_COACH_PLUGIN_DIR . 'blocks/lesson-coach',
			array( 'render_callback' => array( $this, 'render' ) )
		);
	}

	/**
	 * Server-render the block.
	 *
	 * @param array $attributes Block attributes.
	 * @return string
	 */
	public function render( $attributes ) {
		$wp_lesson_id = isset( $attributes['lessonId'] ) ? (int) $attributes['lessonId'] : 0;
		$layout       = isset( $attributes['layout'] ) && 'compact' === $attributes['layout'] ? 'compact' : 'full';
		$heading      = isset( $attributes['heading'] ) ? (string) $attributes['heading'] : '';
		$intro        = isset( $attributes['intro'] ) ? (string) $attributes['intro'] : '';

		$plato_lesson_id = $wp_lesson_id ? (string) get_post_meta( $wp_lesson_id, '_plato_lesson_id', true ) : '';

		$wrapper = get_block_wrapper_attributes(
			array( 'class' => 'agentic-coach agentic-coach--' . $layout )
		);

		ob_start();
		?>
		<div <?php echo wp_kses_data( $wrapper ); ?>>
			<?php if ( $heading ) : ?>
				<h2 class="agentic-coach__heading"><?php echo esc_html( $heading ); ?></h2>
			<?php endif; ?>
			<?php if ( $intro ) : ?>
				<p class="agentic-coach__intro"><?php echo esc_html( $intro ); ?></p>
			<?php endif; ?>
			<?php
			if ( ! $this->settings->is_configured() ) {
				$this->render_notice( __( 'The WordPress Coach is not configured yet.', 'agentic-coach' ), current_user_can( 'manage_options' ) );
			} elseif ( ! $plato_lesson_id ) {
				$this->render_notice( __( 'This lesson has not been published to Plato yet.', 'agentic-coach' ), current_user_can( 'edit_posts' ) );
			} elseif ( ! is_user_logged_in() ) {
				$this->render_login_prompt();
			} else {
				$this->render_mount( $plato_lesson_id );
			}
			?>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Render the interactive mount point consumed by view.js.
	 *
	 * @param string $plato_lesson_id Plato lesson id.
	 * @return void
	 */
	private function render_mount( $plato_lesson_id ) {
		$title = sprintf(
			/* translators: %s: lesson title or generic label. */
			__( 'WordPress coaching for %s', 'agentic-coach' ),
			get_the_title()
		);
		echo wp_kses( Agentic_Coach_Embed::mount_html( $this->settings, $plato_lesson_id, $title ), self::mount_kses() );
	}

	/**
	 * Allowed HTML for the coach mount markup.
	 *
	 * @return array
	 */
	public static function mount_kses() {
		return array(
			'div'      => array(
				'class'            => true,
				'data-plato-url'   => true,
				'data-lesson'      => true,
				'data-endpoint'    => true,
				'data-nonce'       => true,
				'data-frame-title' => true,
				'role'             => true,
				'aria-live'        => true,
			),
			'noscript' => array(),
		);
	}

	/**
	 * Render a sign-in prompt for logged-out visitors.
	 *
	 * @return void
	 */
	private function render_login_prompt() {
		$login = wp_login_url( get_permalink() );
		?>
		<p class="agentic-coach__notice">
			<?php
			printf(
				/* translators: %s: login link. */
				esc_html__( 'Please %s to start coaching.', 'agentic-coach' ),
				'<a href="' . esc_url( $login ) . '">' . esc_html__( 'log in', 'agentic-coach' ) . '</a>'
			);
			?>
		</p>
		<?php
	}

	/**
	 * Render an informational notice, optionally restricted to capable users.
	 *
	 * @param string $message  Message text.
	 * @param bool   $for_user Whether to show it (e.g. only to authors/admins).
	 * @return void
	 */
	private function render_notice( $message, $for_user ) {
		if ( ! $for_user ) {
			return;
		}
		echo '<p class="agentic-coach__notice">' . esc_html( $message ) . '</p>';
	}
}
