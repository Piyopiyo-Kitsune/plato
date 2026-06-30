<?php
/**
 * Server-side HTTP client for the Plato bridge.
 *
 * Holds the shared secret and signs requests; the browser never sees it.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Plato bridge client.
 */
class Agentic_Coach_Plato_Client {

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
	 * Build the canonical signing string. MUST match the Plato server's
	 * `bridgeSigningString` exactly: siteId, wpUserId, lessonId (''), ts —
	 * newline-joined.
	 *
	 * @param string      $site_id    Site identifier.
	 * @param string      $wp_user_id WordPress user id.
	 * @param string|null $lesson_id  Plato lesson id (nullable).
	 * @param int         $ts         Unix timestamp (seconds).
	 * @return string
	 */
	private function signing_string( $site_id, $wp_user_id, $lesson_id, $ts ) {
		return implode( "\n", array( $site_id, $wp_user_id, null === $lesson_id ? '' : $lesson_id, (string) $ts ) );
	}

	/**
	 * Compute the HMAC-SHA256 signature for a bridge request.
	 *
	 * @param string      $site_id    Site identifier.
	 * @param string      $wp_user_id WordPress user id.
	 * @param string|null $lesson_id  Plato lesson id.
	 * @param int         $ts         Timestamp.
	 * @return string Hex signature.
	 */
	private function sign( $site_id, $wp_user_id, $lesson_id, $ts ) {
		return hash_hmac( 'sha256', $this->signing_string( $site_id, $wp_user_id, $lesson_id, $ts ), $this->settings->get_secret() );
	}

	/**
	 * Mint a single-use embed code for a learner.
	 *
	 * @param string $lesson_id Plato lesson id.
	 * @param int    $user_id   WordPress user id.
	 * @return array|WP_Error { code, lessonId } on success.
	 */
	public function mint_embed_code( $lesson_id, $user_id ) {
		if ( ! $this->settings->is_configured() ) {
			return new WP_Error( 'agentic_coach_unconfigured', __( 'The Agentic Coach is not configured.', 'agentic-coach' ) );
		}

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new WP_Error( 'agentic_coach_no_user', __( 'No such user.', 'agentic-coach' ) );
		}

		$site_id    = $this->settings->site_id();
		$wp_user_id = (string) $user_id;
		$ts         = time();

		// GDPR data minimization: send a display name to personalize coaching,
		// but only forward the email when a site explicitly opts in.
		$send_email = (bool) apply_filters( 'agentic_coach_send_email', false, $user_id );

		$body = array(
			'siteId'      => $site_id,
			'wpUserId'    => $wp_user_id,
			'lessonId'    => $lesson_id,
			'displayName' => $user->display_name,
			'email'       => $send_email ? $user->user_email : null,
			'ts'          => $ts,
			'sig'         => $this->sign( $site_id, $wp_user_id, $lesson_id, $ts ),
		);

		$result = $this->request( '/v1/bridge/token', $body );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( empty( $result['code'] ) ) {
			return new WP_Error( 'agentic_coach_bad_response', __( 'Plato did not return an embed code.', 'agentic-coach' ) );
		}
		return $result;
	}

	/**
	 * Build the full iframe embed URL for a lesson + code.
	 *
	 * @param string $lesson_id Plato lesson id.
	 * @param string $code      One-time embed code.
	 * @return string
	 */
	public function embed_url( $lesson_id, $code ) {
		return $this->settings->plato_url() . '/embed/lesson/' . rawurlencode( $lesson_id ) . '?code=' . rawurlencode( $code );
	}

	/**
	 * GDPR erasure: ask Plato to delete the mapped learner and their data.
	 *
	 * @param int $user_id WordPress user id.
	 * @return array|WP_Error
	 */
	public function forget_user( $user_id ) {
		if ( ! $this->settings->is_configured() ) {
			return new WP_Error( 'agentic_coach_unconfigured', __( 'The Agentic Coach is not configured.', 'agentic-coach' ) );
		}
		$site_id    = $this->settings->site_id();
		$wp_user_id = (string) $user_id;
		$ts         = time();
		$body       = array(
			'siteId'   => $site_id,
			'wpUserId' => $wp_user_id,
			'lessonId' => null,
			'ts'       => $ts,
			'sig'      => $this->sign( $site_id, $wp_user_id, null, $ts ),
		);
		return $this->request( '/v1/bridge/forget', $body );
	}

	/**
	 * POST a JSON body to a Plato endpoint and decode the response.
	 *
	 * @param string $path Path beginning with '/'.
	 * @param array  $body Request body.
	 * @return array|WP_Error
	 */
	private function request( $path, array $body ) {
		$response = wp_remote_post(
			$this->settings->plato_url() . $path,
			array(
				'timeout'     => 10,
				'headers'     => array( 'Content-Type' => 'application/json' ),
				'body'        => wp_json_encode( $body ),
				'data_format' => 'body',
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$data   = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $status < 200 || $status >= 300 ) {
			$message = is_array( $data ) && ! empty( $data['error'] )
				? $data['error']
				: sprintf( /* translators: %d: HTTP status code. */ __( 'Plato returned HTTP %d.', 'agentic-coach' ), $status );
			return new WP_Error( 'agentic_coach_http', $message, array( 'status' => $status ) );
		}

		return is_array( $data ) ? $data : array();
	}
}
