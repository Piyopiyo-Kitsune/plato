<?php
/**
 * Plugin Name:       Agentic Coach
 * Plugin URI:        https://github.com/Piyopiyo-Kitsune/plato
 * Description:       Embed a Plato-powered agentic learning coach into WordPress lessons, author coaching content in the editor, and expose lesson context to the coach over MCP.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Plato + WordPress community
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       agentic-coach
 * Domain Path:       /languages
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

define( 'AGENTIC_COACH_VERSION', '0.1.0' );
define( 'AGENTIC_COACH_PLUGIN_FILE', __FILE__ );
define( 'AGENTIC_COACH_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'AGENTIC_COACH_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once AGENTIC_COACH_PLUGIN_DIR . 'includes/class-agentic-coach.php';

/**
 * Boot the plugin once all plugins are loaded.
 *
 * @return void
 */
function agentic_coach_bootstrap() {
	Agentic_Coach::instance()->init();
}
add_action( 'plugins_loaded', 'agentic_coach_bootstrap' );

register_activation_hook( __FILE__, array( 'Agentic_Coach', 'on_activate' ) );
register_deactivation_hook( __FILE__, array( 'Agentic_Coach', 'on_deactivate' ) );
