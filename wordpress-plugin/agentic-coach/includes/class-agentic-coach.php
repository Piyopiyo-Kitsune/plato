<?php
/**
 * Main plugin orchestrator.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Loads modules and wires up activation/deactivation.
 */
final class Agentic_Coach {

	/**
	 * Singleton instance.
	 *
	 * @var Agentic_Coach|null
	 */
	private static $instance = null;

	/**
	 * Settings module.
	 *
	 * @var Agentic_Coach_Settings
	 */
	public $settings;

	/**
	 * Plato bridge client.
	 *
	 * @var Agentic_Coach_Plato_Client
	 */
	public $plato;

	/**
	 * Retrieve the singleton instance.
	 *
	 * @return Agentic_Coach
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor — load dependencies.
	 */
	private function __construct() {
		$dir = AGENTIC_COACH_PLUGIN_DIR . 'includes/';
		require_once $dir . 'class-settings.php';
		require_once $dir . 'class-plato-client.php';
		require_once $dir . 'class-content-types.php';
		require_once $dir . 'class-admin-columns.php';
		require_once $dir . 'class-rest.php';
		require_once $dir . 'class-sync.php';
		require_once $dir . 'class-block.php';
		require_once $dir . 'class-editor-sidebar.php';
		require_once $dir . 'class-abilities.php';
		require_once $dir . 'class-mcp-server.php';
		require_once $dir . 'class-privacy.php';

		$this->settings = new Agentic_Coach_Settings();
		$this->plato    = new Agentic_Coach_Plato_Client( $this->settings );
	}

	/**
	 * Register hooks for all modules.
	 *
	 * @return void
	 */
	public function init() {
		load_plugin_textdomain( 'agentic-coach', false, dirname( plugin_basename( AGENTIC_COACH_PLUGIN_FILE ) ) . '/languages' );

		$this->settings->register();
		( new Agentic_Coach_Content_Types() )->register();
		( new Agentic_Coach_Admin_Columns() )->register();
		( new Agentic_Coach_REST( $this->settings, $this->plato ) )->register();
		( new Agentic_Coach_Sync( $this->plato ) )->register();
		( new Agentic_Coach_Block( $this->settings ) )->register();
		( new Agentic_Coach_Editor_Sidebar( $this->settings ) )->register();
		( new Agentic_Coach_Abilities( $this->settings, $this->plato ) )->register();
		( new Agentic_Coach_MCP_Server() )->register();
		( new Agentic_Coach_Privacy( $this->plato ) )->register();
	}

	/**
	 * Activation: register content types then flush rewrite rules.
	 *
	 * @return void
	 */
	public static function on_activate() {
		require_once AGENTIC_COACH_PLUGIN_DIR . 'includes/class-content-types.php';
		( new Agentic_Coach_Content_Types() )->register_post_types();
		flush_rewrite_rules();
	}

	/**
	 * Deactivation: flush rewrite rules so CPT routes are removed.
	 *
	 * @return void
	 */
	public static function on_deactivate() {
		flush_rewrite_rules();
	}
}
