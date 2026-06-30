<?php
/**
 * Settings: Plato connection + secret storage with capability gating.
 *
 * On multisite the settings are network-level (Super Admin only); on single
 * site they are site-level (Administrator). The shared secret is stored
 * encrypted and is never sent back to the browser in cleartext.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Settings module.
 */
class Agentic_Coach_Settings {

	const OPTION_KEY = 'agentic_coach_settings';

	/**
	 * Register admin menu + form handler.
	 *
	 * @return void
	 */
	public function register() {
		if ( is_multisite() ) {
			add_action( 'network_admin_menu', array( $this, 'add_network_menu' ) );
			add_action( 'network_admin_edit_agentic_coach_save', array( $this, 'handle_save' ) );
		} else {
			add_action( 'admin_menu', array( $this, 'add_menu' ), 11 );
			add_action( 'admin_post_agentic_coach_save', array( $this, 'handle_save' ) );
		}
	}

	/**
	 * Capability required to view/edit settings.
	 *
	 * @return string
	 */
	public static function capability() {
		return is_multisite() ? 'manage_network_options' : 'manage_options';
	}

	/**
	 * Add the single-site settings page.
	 *
	 * @return void
	 */
	public function add_menu() {
		// Nest under the "WordPress Coach" menu for discoverability. Registered at
		// priority 11 so the parent (Content_Types, priority 9) already exists.
		add_submenu_page(
			Agentic_Coach_Content_Types::MENU_SLUG,
			__( 'Settings', 'agentic-coach' ),
			__( 'Settings', 'agentic-coach' ),
			self::capability(),
			'agentic-coach',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Add the network settings page.
	 *
	 * @return void
	 */
	public function add_network_menu() {
		add_submenu_page(
			'settings.php',
			__( 'WordPress Coach', 'agentic-coach' ),
			__( 'WordPress Coach', 'agentic-coach' ),
			self::capability(),
			'agentic-coach',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Read the full settings array from the correct scope.
	 *
	 * @return array
	 */
	private function all() {
		$defaults = array(
			'plato_url'     => '',
			'site_id'       => home_url(),
			'shared_secret' => '',
			'mcp_enabled'   => false,
		);
		$stored   = is_multisite()
			? get_site_option( self::OPTION_KEY, array() )
			: get_option( self::OPTION_KEY, array() );
		return wp_parse_args( is_array( $stored ) ? $stored : array(), $defaults );
	}

	/**
	 * Persist the full settings array to the correct scope.
	 *
	 * @param array $value Settings.
	 * @return void
	 */
	private function save_all( array $value ) {
		if ( is_multisite() ) {
			update_site_option( self::OPTION_KEY, $value );
		} else {
			update_option( self::OPTION_KEY, $value );
		}
	}

	/**
	 * Get a single non-secret setting.
	 *
	 * @param string $key      Setting key.
	 * @param mixed  $fallback Default value.
	 * @return mixed
	 */
	public function get( $key, $fallback = '' ) {
		$all = $this->all();
		return isset( $all[ $key ] ) && '' !== $all[ $key ] ? $all[ $key ] : $fallback;
	}

	/**
	 * The configured Plato base URL, normalized without a trailing slash.
	 *
	 * @return string
	 */
	public function plato_url() {
		return untrailingslashit( (string) $this->get( 'plato_url', '' ) );
	}

	/**
	 * The site identifier sent to Plato (must match Plato's allowlist).
	 *
	 * @return string
	 */
	public function site_id() {
		return (string) $this->get( 'site_id', home_url() );
	}

	/**
	 * Whether MCP exposure is enabled.
	 *
	 * @return bool
	 */
	public function mcp_enabled() {
		return (bool) $this->get( 'mcp_enabled', false );
	}

	/**
	 * Decrypted shared secret (empty string when unset).
	 *
	 * @return string
	 */
	public function get_secret() {
		$all = $this->all();
		$enc = isset( $all['shared_secret'] ) ? (string) $all['shared_secret'] : '';
		return '' === $enc ? '' : $this->decrypt( $enc );
	}

	/**
	 * Whether the plugin is fully configured to talk to Plato.
	 *
	 * @return bool
	 */
	public function is_configured() {
		return '' !== $this->plato_url() && '' !== $this->get_secret();
	}

	/**
	 * Handle the settings form submission.
	 *
	 * @return void
	 */
	public function handle_save() {
		if ( ! current_user_can( self::capability() ) ) {
			wp_die( esc_html__( 'You are not allowed to manage these settings.', 'agentic-coach' ) );
		}
		check_admin_referer( 'agentic_coach_save', 'agentic_coach_nonce' );

		$current = $this->all();

		$current['plato_url']   = isset( $_POST['plato_url'] ) ? esc_url_raw( wp_unslash( $_POST['plato_url'] ) ) : '';
		$current['site_id']     = isset( $_POST['site_id'] ) ? esc_url_raw( wp_unslash( $_POST['site_id'] ) ) : home_url();
		$current['mcp_enabled'] = ! empty( $_POST['mcp_enabled'] );

		// Only overwrite the secret when a new value is supplied; an empty field
		// means "keep existing", and the literal mask never overwrites.
		if ( isset( $_POST['shared_secret'] ) ) {
			$raw = sanitize_text_field( wp_unslash( $_POST['shared_secret'] ) );
			if ( '' !== $raw && ! $this->is_mask( $raw ) ) {
				$current['shared_secret'] = $this->encrypt( $raw );
			}
		}

		$this->save_all( $current );

		$redirect = is_multisite()
			? add_query_arg(
				array(
					'page'    => 'agentic-coach',
					'updated' => 'true',
				),
				network_admin_url( 'settings.php' )
			)
			: add_query_arg(
				array(
					'page'    => 'agentic-coach',
					'updated' => 'true',
				),
				admin_url( 'options-general.php' )
			);
		wp_safe_redirect( $redirect );
		exit;
	}

	/**
	 * Render the settings page.
	 *
	 * @return void
	 */
	public function render_page() {
		if ( ! current_user_can( self::capability() ) ) {
			wp_die( esc_html__( 'You are not allowed to view this page.', 'agentic-coach' ) );
		}
		$all        = $this->all();
		$has_secret = '' !== ( $all['shared_secret'] ?? '' );
		$action_url = is_multisite()
			? network_admin_url( 'edit.php?action=agentic_coach_save' )
			: admin_url( 'admin-post.php' );
		$updated    = isset( $_GET['updated'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only notice flag.
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'WordPress Coach Settings', 'agentic-coach' ); ?></h1>
			<?php if ( $updated ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Settings saved.', 'agentic-coach' ); ?></p></div>
			<?php endif; ?>
			<p>
				<?php esc_html_e( 'These settings connect WordPress to your Plato server. For security, the AI provider key (e.g. Anthropic or Amazon Bedrock) that powers the coach is configured in Plato — not here — so it is never exposed to WordPress or the browser.', 'agentic-coach' ); ?>
			</p>
			<div class="notice notice-info inline">
				<p>
					<strong><?php esc_html_e( 'Where is the AI API key?', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'Set it on the Plato server: ANTHROPIC_API_KEY (or AI_PROVIDER=bedrock with AWS credentials) in Plato\'s environment. The only secret stored here is the bridge shared secret used to authenticate WordPress to Plato.', 'agentic-coach' ); ?>
				</p>
			</div>
			<form method="post" action="<?php echo esc_url( $action_url ); ?>">
				<input type="hidden" name="action" value="agentic_coach_save" />
				<?php wp_nonce_field( 'agentic_coach_save', 'agentic_coach_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="agentic_coach_plato_url"><?php esc_html_e( 'Plato server URL', 'agentic-coach' ); ?></label></th>
						<td>
							<input name="plato_url" id="agentic_coach_plato_url" type="url" class="regular-text" value="<?php echo esc_attr( $all['plato_url'] ); ?>" placeholder="https://plato.example.org" />
							<p class="description"><?php esc_html_e( 'Base URL of your Plato deployment.', 'agentic-coach' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="agentic_coach_site_id"><?php esc_html_e( 'Site identifier', 'agentic-coach' ); ?></label></th>
						<td>
							<input name="site_id" id="agentic_coach_site_id" type="url" class="regular-text" value="<?php echo esc_attr( $all['site_id'] ); ?>" />
							<p class="description"><?php esc_html_e( 'Sent to Plato to identify this site. Must be on Plato\'s allowlist (BRIDGE_ALLOWED_SITES).', 'agentic-coach' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="agentic_coach_shared_secret"><?php esc_html_e( 'Bridge shared secret', 'agentic-coach' ); ?></label></th>
						<td>
							<input name="shared_secret" id="agentic_coach_shared_secret" type="password" autocomplete="new-password" class="regular-text" value="" placeholder="<?php echo $has_secret ? esc_attr( '••••••••••••••••' ) : ''; ?>" />
							<p class="description">
								<?php
								echo $has_secret
									? esc_html__( 'A secret is stored. Leave blank to keep it, or enter a new value to replace it.', 'agentic-coach' )
									: esc_html__( 'Must match BRIDGE_SHARED_SECRET on the Plato server.', 'agentic-coach' );
								?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'WordPress.org knowledge over MCP', 'agentic-coach' ); ?></th>
						<td>
							<label>
								<input name="mcp_enabled" type="checkbox" value="1" <?php checked( ! empty( $all['mcp_enabled'] ) ); ?> />
								<?php esc_html_e( 'Allow Plato to read this site\'s lesson/course context via the MCP adapter.', 'agentic-coach' ); ?>
							</label>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * The placeholder mask shown for an existing secret.
	 *
	 * @param string $value Submitted value.
	 * @return bool
	 */
	private function is_mask( $value ) {
		return (bool) preg_match( '/^\x{2022}+$/u', $value );
	}

	/**
	 * Derive a 32-byte encryption key from WordPress salts.
	 *
	 * @return string
	 */
	private function key() {
		return hash( 'sha256', wp_salt( 'auth' ) . self::OPTION_KEY, true );
	}

	/**
	 * Encrypt a secret for storage.
	 *
	 * @param string $plaintext Secret.
	 * @return string base64(iv).':'.base64(cipher), or plaintext if openssl missing.
	 */
	private function encrypt( $plaintext ) {
		if ( ! function_exists( 'openssl_encrypt' ) ) {
			return $plaintext;
		}
		$iv     = function_exists( 'random_bytes' ) ? random_bytes( 16 ) : openssl_random_pseudo_bytes( 16 );
		$cipher = openssl_encrypt( $plaintext, 'aes-256-cbc', $this->key(), OPENSSL_RAW_DATA, $iv );
		if ( false === $cipher ) {
			return $plaintext;
		}
		return base64_encode( $iv ) . ':' . base64_encode( $cipher ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- transport encoding, not obfuscation.
	}

	/**
	 * Decrypt a stored secret.
	 *
	 * @param string $stored Stored value.
	 * @return string
	 */
	private function decrypt( $stored ) {
		if ( ! function_exists( 'openssl_decrypt' ) || false === strpos( $stored, ':' ) ) {
			return $stored;
		}
		list( $iv_b64, $cipher_b64 ) = explode( ':', $stored, 2 );
		$iv                          = base64_decode( $iv_b64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- transport encoding.
		$cipher                      = base64_decode( $cipher_b64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- transport encoding.
		if ( false === $iv || false === $cipher ) {
			return '';
		}
		$plain = openssl_decrypt( $cipher, 'aes-256-cbc', $this->key(), OPENSSL_RAW_DATA, $iv );
		return false === $plain ? '' : $plain;
	}
}
