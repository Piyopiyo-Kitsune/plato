<?php
/**
 * Custom post types: courses, modules, lessons, and their relationships.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Content types module.
 */
class Agentic_Coach_Content_Types {

	const COURSE = 'agentic_course';
	const MODULE = 'agentic_module';
	const LESSON = 'agentic_lesson';

	/**
	 * Slug of the top-level "WordPress Coach" admin menu the CPTs nest under.
	 */
	const MENU_SLUG = 'wordpress-coach';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_post_types' ) );
		add_action( 'init', array( $this, 'register_meta' ) );
		// Priority 9 so the parent menu exists before WordPress attaches the CPT
		// submenus (which it does on admin_menu at the default priority).
		add_action( 'admin_menu', array( $this, 'register_menu' ), 9 );
	}

	/**
	 * Register the top-level "WordPress Coach" menu that houses the course,
	 * module, and lesson screens (each CPT attaches via show_in_menu).
	 *
	 * @return void
	 */
	public function register_menu() {
		add_menu_page(
			__( 'WordPress Coach', 'agentic-coach' ),
			__( 'WordPress Coach', 'agentic-coach' ),
			'edit_posts',
			self::MENU_SLUG,
			array( $this, 'render_landing' ),
			'dashicons-format-chat',
			26
		);
		// Rename the auto-generated first submenu (duplicates the parent title).
		add_submenu_page(
			self::MENU_SLUG,
			__( 'Overview', 'agentic-coach' ),
			__( 'Overview', 'agentic-coach' ),
			'edit_posts',
			self::MENU_SLUG,
			array( $this, 'render_landing' )
		);
	}

	/**
	 * Render the WordPress Coach overview landing page.
	 *
	 * @return void
	 */
	public function render_landing() {
		$settings_url = is_multisite()
			? network_admin_url( 'settings.php?page=agentic-coach' )
			: admin_url( 'admin.php?page=agentic-coach' );
		$course_url   = admin_url( 'edit.php?post_type=' . self::COURSE );
		$module_url   = admin_url( 'edit.php?post_type=' . self::MODULE );
		$lesson_url   = admin_url( 'edit.php?post_type=' . self::LESSON );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'WordPress Coach', 'agentic-coach' ); ?></h1>
			<p style="max-width:46rem;">
				<?php esc_html_e( 'WordPress Coach lets you author coaching courses, modules, and lessons in WordPress and embed a live, conversational AI coach into any page. Instead of just reading, learners work toward a real outcome in a back-and-forth chat — the coach asks questions, reviews their work, and adapts to how they learn.', 'agentic-coach' ); ?>
			</p>

			<h2><?php esc_html_e( 'Quick links', 'agentic-coach' ); ?></h2>
			<p>
				<a class="button" href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'Settings', 'agentic-coach' ); ?></a>
				<a class="button" href="<?php echo esc_url( $course_url ); ?>"><?php esc_html_e( 'Courses', 'agentic-coach' ); ?></a>
				<a class="button" href="<?php echo esc_url( $module_url ); ?>"><?php esc_html_e( 'Modules', 'agentic-coach' ); ?></a>
				<a class="button" href="<?php echo esc_url( $lesson_url ); ?>"><?php esc_html_e( 'Lessons', 'agentic-coach' ); ?></a>
			</p>

			<h2><?php esc_html_e( 'How to set up a coaching experience', 'agentic-coach' ); ?></h2>
			<ol style="max-width:46rem;">
				<li>
					<strong><?php esc_html_e( 'Connect the coach service.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'In Settings, enter the coach server URL and the bridge shared secret (it must match BRIDGE_SHARED_SECRET on the coach server). For security, the AI provider key that powers the coach lives on the coach server — never in WordPress or the browser.', 'agentic-coach' ); ?>
				</li>
				<li>
					<strong><?php esc_html_e( 'Create a course.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'Under Coaching Courses, add a course such as “WordPress Basics”.', 'agentic-coach' ); ?>
				</li>
				<li>
					<strong><?php esc_html_e( 'Add modules.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'Under Coaching Modules, create modules and use the “Coaching placement” panel (editor sidebar) to assign each to a course and set its order. Learners see lessons grouped under these module headings, in order.', 'agentic-coach' ); ?>
				</li>
				<li>
					<strong><?php esc_html_e( 'Write lessons.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'Under Coaching Lessons, add a title and a short description. In the “Coaching content” panel (open the editor’s document sidebar), enter the Learning Objectives and the Exemplar — the mastery-level outcome the learner should produce — plus an optional Coach Directive. In “Coaching placement”, assign the lesson to its course and module. The coach treats this lesson content as its source of truth.', 'agentic-coach' ); ?>
				</li>
				<li>
					<strong><?php esc_html_e( 'Publish the lesson.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'Open the WordPress Coach panel (the chat icon in the editor’s top-right toolbar) and click “Publish Lesson” — see below for exactly what this does.', 'agentic-coach' ); ?>
				</li>
				<li>
					<strong><?php esc_html_e( 'Embed the coach.', 'agentic-coach' ); ?></strong>
					<?php esc_html_e( 'On any page or post, add the “WordPress Coach” block. Under “Show”, choose “A single lesson” (pick the course and lesson) or “Courses home”, which gives learners the full coach with all their courses. Then publish — logged-in learners get a live, embedded coach.', 'agentic-coach' ); ?>
				</li>
			</ol>

			<h2><?php esc_html_e( 'What “Publish Lesson” does', 'agentic-coach' ); ?></h2>
			<ol style="max-width:46rem;">
				<li><?php esc_html_e( 'Builds the lesson’s content from its title, description, Learning Objectives, Exemplar, and Coach Directive.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'Sends it to the coach service over a signed, server-to-server request (the shared secret never reaches the browser), creating or updating the lesson under a stable id and ensuring its course exists.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'Sets the lesson’s status to published — or keeps it a draft if the WordPress lesson is still a draft.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'Links the WordPress lesson to the coach lesson so the block can embed it. Re-publishing updates the same lesson.', 'agentic-coach' ); ?></li>
			</ol>
			<p style="max-width:46rem;">
				<?php esc_html_e( 'Because the lesson is linked to its course, the coach remembers what each learner demonstrated in earlier lessons of the same course — and never mixes that memory across different courses. Assign a course before publishing to enable this.', 'agentic-coach' ); ?>
			</p>

			<h2><?php esc_html_e( 'What learners experience', 'agentic-coach' ); ?></h2>
			<ul style="max-width:46rem; list-style:disc; margin-left:1.5rem;">
				<li><?php esc_html_e( 'A courses home that lists their courses with progress (“2 of 5 lessons complete”), an All Courses / My Courses view, and one-click enrolling.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'Lessons grouped under their module headings, in the order you set.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'A conversational coach that adapts to the learner, remembers progress across a course, and can reply in the learner’s language (they can switch language at any time).', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'The option to share a screenshot of their work — after a one-time consent notice explaining how images are used.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'A “Your data & privacy” panel where learners can view, edit, or delete what the coach remembers about them, or turn personalization off.', 'agentic-coach' ); ?></li>
				<li><?php esc_html_e( 'In an embed, learners stay signed in through WordPress — no separate coach account or login.', 'agentic-coach' ); ?></li>
			</ul>

			<?php if ( Agentic_Coach_Sensei::is_active() ) : ?>
				<h2><?php esc_html_e( 'Using WordPress Coach with Sensei LMS', 'agentic-coach' ); ?></h2>
				<p style="max-width:46rem;">
					<?php esc_html_e( 'Sensei LMS is active, so you can add a coach to your existing Sensei lessons — no separate courses or modules required. WordPress Coach reuses each lesson’s Sensei course for the coach’s memory.', 'agentic-coach' ); ?>
				</p>
				<ol style="max-width:46rem;">
					<li>
						<strong><?php esc_html_e( 'Edit a Sensei lesson.', 'agentic-coach' ); ?></strong>
						<?php esc_html_e( 'Under Sensei LMS → Lessons, open a lesson and assign it to a Sensei course as usual.', 'agentic-coach' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'Add coaching content.', 'agentic-coach' ); ?></strong>
						<?php esc_html_e( 'In the editor’s document sidebar, open the “Coaching content” panel and enter the Learning Objectives and Exemplar (and an optional Coach Directive).', 'agentic-coach' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'Publish the lesson.', 'agentic-coach' ); ?></strong>
						<?php esc_html_e( 'Open the WordPress Coach panel (chat icon) and click “Publish Lesson”. The lesson is published under its Sensei course.', 'agentic-coach' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'That’s it.', 'agentic-coach' ); ?></strong>
						<?php esc_html_e( 'The coach appears automatically at the end of that Sensei lesson for logged-in learners — no block needed.', 'agentic-coach' ); ?>
					</li>
				</ol>
				<p style="max-width:46rem;">
					<?php esc_html_e( 'Every lesson in the same Sensei course shares one coaching course, so the coach remembers what a learner demonstrated across that course’s lessons — and keeps it separate from other courses.', 'agentic-coach' ); ?>
				</p>
			<?php endif; ?>

			<hr style="max-width:46rem; margin:2rem 0 1rem;">
			<p style="max-width:46rem; color:#646970;">
				<?php
				printf(
					/* translators: %s: link to the Plato open-source project. */
					esc_html__( 'WordPress Coach is powered by %s, an open-source agentic learning platform.', 'agentic-coach' ),
					'<a href="https://github.com/1111philo/plato" target="_blank" rel="noopener noreferrer">Plato</a>'
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Register the three post types.
	 *
	 * @return void
	 */
	public function register_post_types() {
		register_post_type(
			self::COURSE,
			$this->args( __( 'Coaching Courses', 'agentic-coach' ), __( 'Coaching Course', 'agentic-coach' ), 'dashicons-welcome-learn-more' )
		);
		register_post_type(
			self::MODULE,
			$this->args( __( 'Coaching Modules', 'agentic-coach' ), __( 'Coaching Module', 'agentic-coach' ), 'dashicons-category' )
		);
		register_post_type(
			self::LESSON,
			$this->args( __( 'Coaching Lessons', 'agentic-coach' ), __( 'Coaching Lesson', 'agentic-coach' ), 'dashicons-book' )
		);
	}

	/**
	 * Shared CPT args.
	 *
	 * @param string $plural   Plural label.
	 * @param string $singular Singular label.
	 * @param string $icon     Dashicon.
	 * @return array
	 */
	private function args( $plural, $singular, $icon ) {
		return array(
			'labels'          => array(
				'name'          => $plural,
				'singular_name' => $singular,
				'add_new_item'  => sprintf( /* translators: %s: singular label. */ __( 'Add New %s', 'agentic-coach' ), $singular ),
				'edit_item'     => sprintf( /* translators: %s: singular label. */ __( 'Edit %s', 'agentic-coach' ), $singular ),
			),
			'public'          => false,
			'show_ui'         => true,
			'show_in_menu'    => self::MENU_SLUG,
			'show_in_rest'    => true,
			'menu_icon'       => $icon,
			'supports'        => array( 'title', 'editor', 'custom-fields' ),
			'capability_type' => 'post',
			'map_meta_cap'    => true,
		);
	}

	/**
	 * Register relationship + Plato-mapping meta.
	 *
	 * @return void
	 */
	public function register_meta() {
		$auth = function () {
			return current_user_can( 'edit_posts' );
		};

		$string_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_text_field',
					'auth_callback'     => $auth,
				)
			);
		};

		$int_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'integer',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'absint',
					'auth_callback'     => $auth,
				)
			);
		};

		// Multi-line fields (objectives, exemplar, coach directive) must preserve
		// newlines — sanitize_text_field collapses them, which would flatten the
		// objectives list into a single bullet.
		$text_meta = function ( $type, $key ) use ( $auth ) {
			register_post_meta(
				$type,
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_textarea_field',
					'auth_callback'     => $auth,
				)
			);
		};

		// Lesson → course/module relationships + ordering, plus Plato ids.
		$int_meta( self::LESSON, '_agentic_course' );
		$int_meta( self::LESSON, '_agentic_module' );
		$int_meta( self::LESSON, '_agentic_order' );
		$string_meta( self::LESSON, '_plato_lesson_id' );
		$string_meta( self::LESSON, '_plato_course_id' );
		$text_meta( self::LESSON, '_agentic_excerpt' );
		$text_meta( self::LESSON, '_agentic_exemplar' );
		$text_meta( self::LESSON, '_agentic_objectives' );
		$text_meta( self::LESSON, '_agentic_coach_directive' );

		// Module → course relationship + ordering.
		$int_meta( self::MODULE, '_agentic_course' );
		$int_meta( self::MODULE, '_agentic_order' );

		// Course → Plato course id.
		$string_meta( self::COURSE, '_plato_course_id' );
	}
}
