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
				echo (int) $this->count_related( Agentic_Coach_Content_Types::MODULE, $post_id );
				break;
			case 'agentic_lessons':
				echo (int) $this->count_related( Agentic_Coach_Content_Types::LESSON, $post_id );
				break;
			case 'agentic_modified':
				echo esc_html( $this->modified( $post_id ) );
				break;
		}
	}

	/**
	 * Make the Last Modified column sortable (maps to the built-in `modified`).
	 *
	 * @param array $columns Sortable columns.
	 * @return array
	 */
	public function sortable_columns( $columns ) {
		$columns['agentic_modified'] = 'modified';
		return $columns;
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
