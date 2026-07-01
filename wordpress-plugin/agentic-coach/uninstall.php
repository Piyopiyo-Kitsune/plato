<?php
/**
 * Uninstall cleanup for WordPress Coach.
 *
 * Removes plugin settings. Course/module/lesson content is intentionally left
 * in place so it is not lost on an accidental uninstall.
 *
 * @package AgenticCoach
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( is_multisite() ) {
	delete_site_option( 'agentic_coach_settings' );
} else {
	delete_option( 'agentic_coach_settings' );
}
