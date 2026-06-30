<?php
/**
 * MCP Adapter server registration.
 *
 * Exposes the plugin's read abilities as an MCP server so Plato's coach can
 * fetch live lesson/course context over MCP (authenticated with Application
 * Passwords / OAuth 2.1, per the MCP Adapter). Guarded and tolerant: a no-op
 * when the MCP Adapter is absent or MCP exposure is disabled in settings.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * MCP server module.
 */
class Agentic_Coach_MCP_Server {

	/**
	 * Register on the MCP Adapter init hook.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'mcp_adapter_init', array( $this, 'create_server' ) );
	}

	/**
	 * Create the MCP server exposing read abilities.
	 *
	 * @param mixed $adapter The MCP Adapter instance.
	 * @return void
	 */
	public function create_server( $adapter ) {
		$settings = Agentic_Coach::instance()->settings;
		if ( ! $settings->mcp_enabled() ) {
			return;
		}
		if ( ! is_object( $adapter ) || ! method_exists( $adapter, 'create_server' ) ) {
			return;
		}

		$transport     = $this->first_class(
			array(
				'\WP\MCP\Transport\Http\RestTransport',
				'\WP\MCP\Transport\HttpTransport',
			)
		);
		$error_handler = $this->first_class(
			array(
				'\WP\MCP\Infrastructure\ErrorHandling\NullMcpErrorHandler',
				'\WP\MCP\Handlers\NullErrorHandler',
			)
		);
		$observability = $this->first_class(
			array(
				'\WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler',
				'\WP\MCP\Handlers\NullObservabilityHandler',
			)
		);

		if ( ! $transport ) {
			return;
		}

		$abilities = array(
			'agentic-coach/list-courses',
			'agentic-coach/get-lesson-context',
		);

		try {
			$adapter->create_server(
				'agentic-coach',
				'agentic-coach',
				'mcp',
				__( 'WordPress Coach', 'agentic-coach' ),
				__( 'Lesson and course context for the Plato coach.', 'agentic-coach' ),
				AGENTIC_COACH_VERSION,
				array( $transport ),
				$error_handler,
				$observability,
				$abilities
			);
		} catch ( \Throwable $e ) {
			// MCP wiring is best-effort; never fatal a request over it.
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[agentic-coach] MCP server registration failed: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- debug-only.
			}
		}
	}

	/**
	 * Return the first class name that exists from a candidate list.
	 *
	 * @param string[] $candidates Fully-qualified class names.
	 * @return string|null
	 */
	private function first_class( array $candidates ) {
		foreach ( $candidates as $candidate ) {
			if ( class_exists( $candidate ) ) {
				return $candidate;
			}
		}
		return null;
	}
}
