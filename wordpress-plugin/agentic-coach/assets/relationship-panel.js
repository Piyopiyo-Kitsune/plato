/**
 * Document settings panel for assigning coaching placement:
 *   - Module → Course (+ order)
 *   - Lesson → Course → Module (+ order)
 *
 * Values are bound to post meta via useEntityProp, so they save with the post
 * (no separate save handler). Dependency-light (uses global `wp` packages).
 *
 * @package AgenticCoach
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var __ = wp.i18n.__;
	var apiFetch = wp.apiFetch;
	var useSelect = wp.data.useSelect;
	var useEntityProp = wp.coreData.useEntityProp;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel =
		( wp.editor && wp.editor.PluginDocumentSettingPanel ) ||
		( wp.editPost && wp.editPost.PluginDocumentSettingPanel );
	var SelectControl = wp.components.SelectControl;
	var TextControl = wp.components.TextControl;

	function toOptions( items, emptyLabel ) {
		var opts = [ { label: emptyLabel, value: 0 } ];
		( items || [] ).forEach( function ( item ) {
			opts.push( { label: item.title || '#' + item.id, value: item.id } );
		} );
		return opts;
	}

	function Panel() {
		var postType = useSelect( function ( select ) {
			return select( 'core/editor' ).getCurrentPostType();
		}, [] );

		var isModule = 'agentic_module' === postType;
		var isLesson = 'agentic_lesson' === postType;

		var metaProp = useEntityProp( 'postType', postType || 'post', 'meta' );
		var meta = metaProp[ 0 ] || {};
		var setMeta = metaProp[ 1 ];

		var coursesState = useState( [] );
		var courses = coursesState[ 0 ];
		var setCourses = coursesState[ 1 ];
		var modulesState = useState( [] );
		var modules = modulesState[ 0 ];
		var setModules = modulesState[ 1 ];

		var courseId = meta._agentic_course || 0;

		useEffect( function () {
			if ( ! isModule && ! isLesson ) {
				return;
			}
			apiFetch( { path: '/agentic-coach/v1/courses' } ).then( setCourses ).catch( function () {
				setCourses( [] );
			} );
		}, [ isModule, isLesson ] );

		useEffect( function () {
			if ( ! isLesson ) {
				return;
			}
			var path = '/agentic-coach/v1/modules' + ( courseId ? '?course=' + courseId : '' );
			apiFetch( { path: path } ).then( setModules ).catch( function () {
				setModules( [] );
			} );
		}, [ isLesson, courseId ] );

		if ( ! PluginDocumentSettingPanel || ( ! isModule && ! isLesson ) ) {
			return null;
		}

		function update( fields ) {
			setMeta( Object.assign( {}, meta, fields ) );
		}

		var controls = [];
		controls.push(
			el( SelectControl, {
				key: 'course',
				label: __( 'Course', 'agentic-coach' ),
				value: courseId,
				options: toOptions( courses, __( '— Select a course —', 'agentic-coach' ) ),
				onChange: function ( v ) {
					// Changing the course clears a now-mismatched module selection.
					update( isLesson ? { _agentic_course: parseInt( v, 10 ) || 0, _agentic_module: 0 } : { _agentic_course: parseInt( v, 10 ) || 0 } );
				},
				help: isLesson ? __( 'Lessons inherit cross-lesson coach memory within their course.', 'agentic-coach' ) : undefined,
			} )
		);

		if ( isLesson ) {
			controls.push(
				el( SelectControl, {
					key: 'module',
					label: __( 'Module', 'agentic-coach' ),
					value: meta._agentic_module || 0,
					options: toOptions( modules, __( '— Select a module —', 'agentic-coach' ) ),
					disabled: ! courseId,
					onChange: function ( v ) {
						update( { _agentic_module: parseInt( v, 10 ) || 0 } );
					},
				} )
			);
		}

		controls.push(
			el( TextControl, {
				key: 'order',
				type: 'number',
				label: __( 'Order', 'agentic-coach' ),
				value: meta._agentic_order || 0,
				onChange: function ( v ) {
					update( { _agentic_order: parseInt( v, 10 ) || 0 } );
				},
			} )
		);

		return el(
			PluginDocumentSettingPanel,
			{ name: 'agentic-coach-placement', title: __( 'Coaching placement', 'agentic-coach' ) },
			controls
		);
	}

	registerPlugin( 'agentic-coach-placement', { render: Panel } );
} )( window.wp );
