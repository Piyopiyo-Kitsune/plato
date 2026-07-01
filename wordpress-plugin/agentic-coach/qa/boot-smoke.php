<?php
/**
 * Plugin boot harness: load the real WordPress Coach plugin against a stubbed
 * WordPress API, fire init/rest_api_init, and assert it wires up with no fatals.
 */
error_reporting( E_ALL & ~E_DEPRECATED );
define( 'ABSPATH', __DIR__ . '/' );
$PLUGIN = dirname( __DIR__ );

$GLOBALS['hooks']  = array();
$GLOBALS['filters'] = array();
$GLOBALS['cpts']   = array();
$GLOBALS['routes'] = array();
$GLOBALS['blocks'] = array();

// --- WordPress API stubs (record where useful) -------------------------------
function add_action( $h, $cb, $p = 10, $a = 1 ) { $GLOBALS['hooks'][ $h ][] = $cb; return true; }
function add_filter( $h, $cb, $p = 10, $a = 1 ) { $GLOBALS['filters'][ $h ][] = $cb; return true; }
function do_action_all( $h, ...$args ) { foreach ( $GLOBALS['hooks'][ $h ] ?? array() as $cb ) { call_user_func_array( $cb, $args ); } }
function apply_filters_all( $h, $value ) { foreach ( $GLOBALS['filters'][ $h ] ?? array() as $cb ) { $value = $cb( $value ); } return $value; }

function register_activation_hook( $f, $cb ) {}
function register_deactivation_hook( $f, $cb ) {}
function plugin_dir_path( $f ) { return rtrim( dirname( $f ), '/' ) . '/'; }
function plugin_dir_url( $f ) { return 'http://example.test/wp-content/plugins/agentic-coach/'; }
function plugin_basename( $f ) { return 'agentic-coach/agentic-coach.php'; }
function load_plugin_textdomain( $d, $a, $p ) { return true; }
function is_multisite() { return false; }
function current_user_can( $c, $o = null ) { return true; }
function is_user_logged_in() { return true; }
function did_action( $h ) { return 0; }
function function_exists_stub() {}

function register_post_type( $type, $args ) { $GLOBALS['cpts'][] = $type; $GLOBALS['cpt_menu'][ $type ] = $args['show_in_menu'] ?? null; return (object) array( 'name' => $type ); }
function register_post_meta( $type, $key, $args ) { return true; }
function register_rest_route( $ns, $route, $args ) { $GLOBALS['routes'][] = $ns . $route; return true; }
function register_block_type( $arg, $args = array() ) {
	$name = $arg;
	$json = is_dir( $arg ) ? $arg . '/block.json' : null;
	if ( $json && file_exists( $json ) ) { $name = json_decode( file_get_contents( $json ), true )['name']; }
	$GLOBALS['blocks'][] = $name;
	return (object) array( 'name' => $name );
}
function wp_register_script( ...$a ) { return true; }
function wp_register_style( ...$a ) { return true; }
function wp_enqueue_script( ...$a ) { return true; }
function wp_set_script_translations( ...$a ) { return true; }
function get_current_screen() { return (object) array( 'post_type' => 'agentic_lesson' ); }

function add_options_page( ...$a ) { return true; }
function add_menu_page( $page, $menu, $cap, $slug, $cb = null, $icon = '', $pos = null ) { $GLOBALS['menus'][] = $slug; return $slug; }
function add_submenu_page( $parent, $page, $menu, $cap, $slug, $cb = null ) { $GLOBALS['submenus'][] = $parent . '|' . $slug; return $slug; }
function admin_url( $p = '' ) { return 'http://example.test/wp-admin/' . $p; }
function wp_add_privacy_policy_content( ...$a ) { return true; }
function wpautop( $s ) { return $s; }
function wp_kses_post( $s ) { return $s; }
function wp_kses_data( $s ) { return $s; }

function get_posts( $a ) { return array(); }
function get_post( $id ) { return null; }
function get_post_meta( $id, $k, $s = false ) { return ''; }
function get_the_title( $id = 0 ) { return 'Title'; }
function get_permalink( $id = 0 ) { return 'http://example.test/lesson'; }
function wp_login_url( $r = '' ) { return 'http://example.test/wp-login.php'; }
function home_url( $p = '' ) { return 'http://example.test'; }
function untrailingslashit( $s ) { return rtrim( $s, '/' ); }
function rest_url( $p = '' ) { return 'http://example.test/wp-json/' . $p; }
function wp_create_nonce( $a = '' ) { return 'nonce123'; }
function get_block_wrapper_attributes( $a = array() ) { return 'class="' . ( $a['class'] ?? '' ) . '"'; }
function apply_filters( $t, $v ) { return $v; }
function __( $s, $d = null ) { return $s; }
function esc_html__( $s, $d = null ) { return $s; }
function esc_attr__( $s, $d = null ) { return $s; }
function esc_html( $s ) { return $s; }
function esc_attr( $s ) { return $s; }
function esc_url( $s ) { return $s; }
function esc_url_raw( $s ) { return $s; }
function checked( $a, $b = true, $e = true ) { return ''; }
function submit_button( ...$a ) { return ''; }
function wp_nonce_field( ...$a ) { return ''; }
function get_site_option( $k, $d = false ) { return $d; }
function get_option( $k, $d = false ) { return $d; }
function wp_salt( $s = '' ) { return 'salt-value'; }

class WP_REST_Server { const READABLE = 'GET'; const CREATABLE = 'POST'; const EDITABLE = 'PUT'; }
class WP_Error {
	public $code; public $message;
	public function __construct( $c = '', $m = '' ) { $this->code = $c; $this->message = $m; }
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
}

// --- Load and boot the real plugin ------------------------------------------
require $PLUGIN . '/agentic-coach.php';

// plugins_loaded -> bootstrap.
agentic_coach_bootstrap();

// Fire the registration hooks.
do_action_all( 'init' );
do_action_all( 'admin_menu' );
do_action_all( 'rest_api_init' );
do_action_all( 'enqueue_block_editor_assets' );
apply_filters_all( 'wp_privacy_personal_data_exporters', array() );
apply_filters_all( 'wp_privacy_personal_data_erasers', array() );

// --- Assertions --------------------------------------------------------------
$fail = 0;
function check( $cond, $msg ) { global $fail; if ( $cond ) { echo "ok  - $msg\n"; } else { echo "FAIL - $msg\n"; $fail++; } }

foreach ( array( 'agentic_course', 'agentic_module', 'agentic_lesson' ) as $cpt ) {
	check( in_array( $cpt, $GLOBALS['cpts'], true ), "CPT registered: $cpt" );
}
foreach ( array( 'agentic-coach/v1/embed-token', 'agentic-coach/v1/courses', 'agentic-coach/v1/publish-lesson', 'agentic-coach/v1/author-coach' ) as $r ) {
	check( in_array( $r, $GLOBALS['routes'], true ), "REST route: $r" );
}
check( in_array( 'agentic-coach/lesson-coach', $GLOBALS['blocks'], true ), 'block registered: agentic-coach/lesson-coach' );
check( in_array( 'wordpress-coach', $GLOBALS['menus'] ?? array(), true ), 'parent menu registered: WordPress Coach' );
foreach ( array( 'agentic_course', 'agentic_module', 'agentic_lesson' ) as $cpt ) {
	check( ( $GLOBALS['cpt_menu'][ $cpt ] ?? null ) === 'wordpress-coach', "CPT $cpt nests under WordPress Coach" );
}
check( ! empty( $GLOBALS['filters']['wp_privacy_personal_data_erasers'] ), 'GDPR eraser filter registered' );
check( ! empty( $GLOBALS['hooks']['admin_menu'] ), 'settings menu registered (single-site)' );

echo "\n" . ( $fail ? "BOOT TEST FAILED ($fail)\n" : "PLUGIN BOOTS AND REGISTERS EVERYTHING\n" );
exit( $fail ? 1 : 0 );
