<?php
/**
 * Admin list-table columns for courses, modules, and lessons.
 *
 * Read-only: surfaces relationships, counts, and the last-modified time. Never
 * modifies content.
 *
 * @package AgenticCoach
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin columns module.
 */
class Agentic_Coach_Admin_Columns {

	/**
	 * Register column hooks for the three post types.
	 *
	 * @return void
	 */
	public function register() {
		$lesson = Agentic_Coach_Content_Types::LESSON;
		$module = Agentic_Coach_Content_Types::MODULE;
		$course = Agentic_Coach_Content_Types::COURSE;

		add_filter( "manage_{$lesson}_posts_columns", array( $this, 'lesson_columns' ) );
		add_action( "manage_{$lesson}_posts_custom_column", array( $this, 'render_lesson_column' ), 10, 2 );

		add_filter( "manage_{$module}_posts_columns", array( $this, 'module_columns' ) );
		add_action( "manage_{$module}_posts_custom_column", array( $this, 'render_module_column' ), 10, 2 );

		add_filter( "manage_{$course}_posts_columns", array( $this, 'course_columns' ) );
		add_action( "manage_{$course}_posts_custom_column", array( $this, 'render_course_column' ), 10, 2 );

		foreach ( array( $lesson, $module, $course ) as $type ) {
			add_filter( "manage_edit-{$type}_sortable_columns", array( $this, 'sortable_columns' ) );
		}

		add_action( 'restrict_manage_posts', array( $this, 'render_filters' ) );
		add_action( 'pre_get_posts', array( $this, 'filter_and_sort' ) );
	}

	/**
	 * Replace the default Date column with our columns, preserving cb + title.
	 *
	 * @param array $columns Existing columns.
	 * @param array $additions Key => label columns to append.
	 * @return array
	 */
	private function rebuild( $columns, $additions ) {
		$new = array();
		foreach ( $columns as $key => $label ) {
			if ( 'date' === $key ) {
				continue;
			}
			$new[ $key ] = $label;
		}
		return array_merge( $new, $additions );
	}

	/**
	 * Lesson columns: Course, Module, Last Modified.
	 *
	 * @param array $columns Columns.
	 * @return array
	 */
	public function lesson_columns( $columns ) {
		return $this->rebuild(
			$columns,
			array(
				'agentic_course'   => __( 'Course', 'agentic-coach' ),
				'agentic_module'   => __( 'Module', 'agentic-coach' ),
				'agentic_modified' => __( 'Last Modified', 'agentic-coach' ),
			)
		);
	}

	/**
	 * Module columns: Course, Last Modified.
	 *
	 * @param array $columns Columns.
	 * @return array
	 */
	public function module_columns( $columns ) {
		return $this->rebuild(
			$columns,
			array(
				'agentic_course'   => __( 'Course', 'agentic-coach' ),
				'agentic_modified' => __( 'Last Modified', 'agentic-coach' ),
			)
		);
	}

	/**
	 * Course columns: Modules count, Lessons count, Last Modified.
	 *
	 * @param array $columns Columns.
	 * @return array
	 */
	public function course_columns( $columns ) {
		return $this->rebuild(
			$columns,
			array(
				'agentic_modules'  => __( 'Modules', 'agentic-coach' ),
				'agentic_lessons'  => __( 'Lessons', 'agentic-coach' ),
				'agentic_modified' => __( 'Last Modified', 'agentic-coach' ),
			)
		);
	}

	/**
	 * Render a lesson row cell.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Post id.
	 * @return void
	 */
	public function render_lesson_column( $column, $post_id ) {
		switch ( $column ) {
			case 'agentic_course':
				echo wp_kses_post( $this->post_link( (int) get_post_meta( $post_id, '_agentic_course', true ) ) );
				break;
			case 'agentic_module':
				echo wp_kses_post( $this->post_link( (int) get_post_meta( $post_id, '_agentic_module', true ) ) );
				break;
			case 'agentic_modified':
				echo esc_html( $this->modified( $post_id ) );
				break;
		}
	}

	/**
	 * Render a module row cell.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Post id.
	 * @return void
	 */
	public function render_module_column( $column, $post_id ) {
		switch ( $column ) {
			case 'agentic_course':
				echo wp_kses_post( $this->post_link( (int) get_post_meta( $post_id, '_agentic_course', true ) ) );
				break;
			case 'agentic_modified':
				echo esc_html( $this->modified( $post_id ) );
				break;
		}
	}

	/**
	 * Render a course row cell.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Post id.
	 * @return void
	 */
	public function render_course_column( $column, $post_id ) {
		switch ( $column ) {
			case 'agentic_modules':
				echo wp_kses_post( $this->count_link( Agentic_Coach_Content_Types::MODULE, $post_id ) );
				break;
			case 'agentic_lessons':
				echo wp_kses_post( $this->count_link( Agentic_Coach_Content_Types::LESSON, $post_id ) );
				break;
			case 'agentic_modified':
				echo esc_html( $this->modified( $post_id ) );
				break;
		}
	}

	/**
	 * A related-count rendered as a link to the pre-filtered list (or plain 0).
	 *
	 * @param string $post_type Related post type (module or lesson).
	 * @param int    $course_id Course post id.
	 * @return string
	 */
	private function count_link( $post_type, $course_id ) {
		$count = $this->count_related( $post_type, $course_id );
		if ( ! $count ) {
			return '0';
		}
		$url = add_query_arg(
			array(
				'post_type'             => $post_type,
				'agentic_course_filter' => $course_id,
			),
			admin_url( 'edit.php' )
		);
		return '<a href="' . esc_url( $url ) . '">' . (int) $count . '</a>';
	}

	/**
	 * Make Last Modified, Course, and Module columns sortable. `modified` maps to
	 * the core orderby; course/module are handled in filter_and_sort().
	 *
	 * @param array $columns Sortable columns.
	 * @return array
	 */
	public function sortable_columns( $columns ) {
		$columns['agentic_modified'] = 'modified';
		$columns['agentic_course']   = 'agentic_course';
		$columns['agentic_module']   = 'agentic_module';
		return $columns;
	}

	/**
	 * Render Course (and, for lessons, Module) filter dropdowns above the list.
	 *
	 * @param string $post_type Current list post type.
	 * @return void
	 */
	public function render_filters( $post_type ) {
		if ( Agentic_Coach_Content_Types::LESSON !== $post_type && Agentic_Coach_Content_Types::MODULE !== $post_type ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- navigational read-only filter.
		$current_course = isset( $_GET['agentic_course_filter'] ) ? absint( $_GET['agentic_course_filter'] ) : 0;
		$this->dropdown(
			'agentic_course_filter',
			__( 'Filter by course', 'agentic-coach' ),
			__( 'All courses', 'agentic-coach' ),
			$this->posts_for_filter( Agentic_Coach_Content_Types::COURSE ),
			$current_course
		);

		if ( Agentic_Coach_Content_Types::LESSON === $post_type ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- navigational read-only filter.
			$current_module = isset( $_GET['agentic_module_filter'] ) ? absint( $_GET['agentic_module_filter'] ) : 0;
			$this->dropdown(
				'agentic_module_filter',
				__( 'Filter by module', 'agentic-coach' ),
				__( 'All modules', 'agentic-coach' ),
				$this->posts_for_filter( Agentic_Coach_Content_Types::MODULE ),
				$current_module
			);
		}
	}

	/**
	 * Echo a labeled filter dropdown.
	 *
	 * @param string $name     Field name.
	 * @param string $label    Accessible label.
	 * @param string $all      "All" option label.
	 * @param array  $posts    Posts to list.
	 * @param int    $selected Currently selected id.
	 * @return void
	 */
	private function dropdown( $name, $label, $all, $posts, $selected ) {
		echo '<label class="screen-reader-text" for="' . esc_attr( $name ) . '">' . esc_html( $label ) . '</label>';
		echo '<select name="' . esc_attr( $name ) . '" id="' . esc_attr( $name ) . '">';
		echo '<option value="0">' . esc_html( $all ) . '</option>';
		foreach ( $posts as $post ) {
			printf(
				'<option value="%d" %s>%s</option>',
				(int) $post->ID,
				selected( $selected, $post->ID, false ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- selected() returns a safe attribute string.
				esc_html( $post->post_title )
			);
		}
		echo '</select>';
	}

	/**
	 * Apply course/module filters and course/module sorting to the admin list.
	 *
	 * @param WP_Query $query Query.
	 * @return void
	 */
	public function filter_and_sort( $query ) {
		if ( ! is_admin() || ! $query->is_main_query() ) {
			return;
		}
		$post_type = $query->get( 'post_type' );
		if ( Agentic_Coach_Content_Types::LESSON !== $post_type && Agentic_Coach_Content_Types::MODULE !== $post_type ) {
			return;
		}

		$meta_query = array();

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- navigational read-only filter.
		$course_filter = isset( $_GET['agentic_course_filter'] ) ? absint( $_GET['agentic_course_filter'] ) : 0;
		if ( $course_filter ) {
			$meta_query['course_filter'] = array(
				'key'   => '_agentic_course',
				'value' => $course_filter,
			);
		}

		if ( Agentic_Coach_Content_Types::LESSON === $post_type ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- navigational read-only filter.
			$module_filter = isset( $_GET['agentic_module_filter'] ) ? absint( $_GET['agentic_module_filter'] ) : 0;
			if ( $module_filter ) {
				$meta_query['module_filter'] = array(
					'key'   => '_agentic_module',
					'value' => $module_filter,
				);
			}
		}

		$orderby = $query->get( 'orderby' );
		$order   = strtoupper( $query->get( 'order' ) ) === 'DESC' ? 'DESC' : 'ASC';
		if ( 'agentic_course' === $orderby ) {
			$meta_query['course_sort'] = array(
				'key'     => '_agentic_course',
				'compare' => 'EXISTS',
			);
			$query->set( 'orderby', array( 'course_sort' => $order ) );
		} elseif ( 'agentic_module' === $orderby ) {
			$meta_query['module_sort'] = array(
				'key'     => '_agentic_module',
				'compare' => 'EXISTS',
			);
			$query->set( 'orderby', array( 'module_sort' => $order ) );
		}

		if ( $meta_query ) {
			$query->set( 'meta_query', $meta_query ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- admin list filtering.
		}
	}

	/**
	 * Posts of a type for a filter dropdown, ordered by title.
	 *
	 * @param string $post_type Post type.
	 * @return WP_Post[]
	 */
	private function posts_for_filter( $post_type ) {
		return get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
				'orderby'        => 'title',
				'order'          => 'ASC',
				'posts_per_page' => 200, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- bounded authoring set.
				'no_found_rows'  => true,
			)
		);
	}

	/**
	 * Edit link to a related post, or an em dash when unassigned/missing.
	 *
	 * @param int $post_id Related post id.
	 * @return string
	 */
	private function post_link( $post_id ) {
		if ( ! $post_id ) {
			return '&mdash;';
		}
		$title = get_the_title( $post_id );
		if ( '' === $title ) {
			return '&mdash;';
		}
		$edit = get_edit_post_link( $post_id );
		return $edit
			? '<a href="' . esc_url( $edit ) . '">' . esc_html( $title ) . '</a>'
			: esc_html( $title );
	}

	/**
	 * Localized last-modified date + time for a post.
	 *
	 * @param int $post_id Post id.
	 * @return string
	 */
	private function modified( $post_id ) {
		$timestamp = get_post_modified_time( 'U', false, $post_id );
		if ( ! $timestamp ) {
			return '—';
		}
		return date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $timestamp );
	}

	/**
	 * Count posts of a type attached to a course.
	 *
	 * @param string $post_type Related post type.
	 * @param int    $course_id Course post id.
	 * @return int
	 */
	private function count_related( $post_type, $course_id ) {
		$ids = get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
				'fields'         => 'ids',
				'posts_per_page' => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- bounded count for a single course.
				'meta_key'       => '_agentic_course', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin list count.
				'meta_value'     => $course_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- admin list count.
				'no_found_rows'  => true,
			)
		);
		return count( $ids );
	}
}
