<?php
/**
 * GDPR integration: declare the data shared with Plato and honor erasure.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Privacy module.
 */
class Agentic_Coach_Privacy {

	/**
	 * Plato client.
	 *
	 * @var Agentic_Coach_Plato_Client
	 */
	private $plato;

	/**
	 * Constructor.
	 *
	 * @param Agentic_Coach_Plato_Client $plato Plato client.
	 */
	public function __construct( Agentic_Coach_Plato_Client $plato ) {
		$this->plato = $plato;
	}

	/**
	 * Register privacy hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_init', array( $this, 'add_privacy_policy_content' ) );
		add_filter( 'wp_privacy_personal_data_exporters', array( $this, 'register_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( $this, 'register_eraser' ) );
	}

	/**
	 * Suggested privacy policy text.
	 *
	 * @return void
	 */
	public function add_privacy_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$content = __( 'When you use an embedded WordPress Coach, your coaching conversation and progress are processed by the connected coaching service under a pseudonymous identifier derived from your account. Your email address is only shared if the site administrator has enabled it.', 'agentic-coach' );
		wp_add_privacy_policy_content( __( 'WordPress Coach', 'agentic-coach' ), wp_kses_post( wpautop( $content ) ) );
	}

	/**
	 * Register the personal-data exporter.
	 *
	 * @param array $exporters Exporters.
	 * @return array
	 */
	public function register_exporter( $exporters ) {
		$exporters['agentic-coach'] = array(
			'exporter_friendly_name' => __( 'WordPress Coach', 'agentic-coach' ),
			'callback'               => array( $this, 'export' ),
		);
		return $exporters;
	}

	/**
	 * Register the personal-data eraser.
	 *
	 * @param array $erasers Erasers.
	 * @return array
	 */
	public function register_eraser( $erasers ) {
		$erasers['agentic-coach'] = array(
			'eraser_friendly_name' => __( 'WordPress Coach', 'agentic-coach' ),
			'callback'             => array( $this, 'erase' ),
		);
		return $erasers;
	}

	/**
	 * Export: declare that a mapped Plato learner exists.
	 *
	 * @param string $email Email address.
	 * @return array
	 */
	public function export( $email ) {
		$user = get_user_by( 'email', $email );
		$data = array();
		if ( $user ) {
			$data[] = array(
				'group_id'    => 'agentic-coach',
				'group_label' => __( 'WordPress Coach', 'agentic-coach' ),
				'item_id'     => 'agentic-coach-' . $user->ID,
				'data'        => array(
					array(
						'name'  => __( 'Coaching account', 'agentic-coach' ),
						'value' => __( 'A pseudonymous learner record holds your coaching chat history and course progress.', 'agentic-coach' ),
					),
				),
			);
		}
		return array(
			'data' => $data,
			'done' => true,
		);
	}

	/**
	 * Erase: ask Plato to delete the mapped learner's data.
	 *
	 * @param string $email Email address.
	 * @return array
	 */
	public function erase( $email ) {
		$user     = get_user_by( 'email', $email );
		$messages = array();
		$removed  = false;

		if ( $user ) {
			$result = $this->plato->forget_user( $user->ID );
			if ( is_wp_error( $result ) ) {
				$messages[] = $result->get_error_message();
			} else {
				$removed = true;
			}
		}

		return array(
			'items_removed'  => $removed,
			'items_retained' => false,
			'messages'       => $messages,
			'done'           => true,
		);
	}
}
