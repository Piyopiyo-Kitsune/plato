/**
 * Editor UI for the Agentic Coach block.
 *
 * Dependency-light (no JSX build step): uses the global `wp` packages enqueued
 * as script dependencies, so it runs in wp-env without compilation.
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
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var TextControl = wp.components.TextControl;
	var ToggleControl = wp.components.ToggleControl;
	var Notice = wp.components.Notice;

	function toOptions( items, labelKey, emptyLabel ) {
		var opts = [ { label: emptyLabel, value: 0 } ];
		( items || [] ).forEach( function ( item ) {
			opts.push( { label: item[ labelKey ] || '#' + item.id, value: item.id } );
		} );
		return opts;
	}

	wp.blocks.registerBlockType( 'agentic-coach/lesson-coach', {
		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			var blockProps = useBlockProps();

			var courseState = useState( [] );
			var courses = courseState[ 0 ];
			var setCourses = courseState[ 1 ];

			var lessonState = useState( [] );
			var lessons = lessonState[ 0 ];
			var setLessons = lessonState[ 1 ];

			useEffect( function () {
				apiFetch( { path: '/agentic-coach/v1/courses' } )
					.then( setCourses )
					.catch( function () { setCourses( [] ); } );
			}, [] );

			useEffect( function () {
				if ( ! attributes.courseId ) {
					setLessons( [] );
					return;
				}
				apiFetch( { path: '/agentic-coach/v1/courses/' + attributes.courseId + '/lessons' } )
					.then( setLessons )
					.catch( function () { setLessons( [] ); } );
			}, [ attributes.courseId ] );

			var selectedLesson = ( lessons || [] ).filter( function ( l ) {
				return l.id === attributes.lessonId;
			} )[ 0 ];
			var notPublished = selectedLesson && ! selectedLesson.platoLesson;

			return el(
				'div',
				blockProps,
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{ title: __( 'Coach source', 'agentic-coach' ), initialOpen: true },
						el( SelectControl, {
							label: __( 'Course', 'agentic-coach' ),
							value: attributes.courseId,
							options: toOptions( courses, 'title', __( 'Select a course…', 'agentic-coach' ) ),
							onChange: function ( v ) {
								setAttributes( { courseId: parseInt( v, 10 ) || 0, lessonId: 0 } );
							},
						} ),
						el( SelectControl, {
							label: __( 'Lesson', 'agentic-coach' ),
							value: attributes.lessonId,
							options: toOptions( lessons, 'title', __( 'Select a lesson…', 'agentic-coach' ) ),
							onChange: function ( v ) {
								setAttributes( { lessonId: parseInt( v, 10 ) || 0 } );
							},
						} ),
						notPublished
							? el( Notice, { status: 'warning', isDismissible: false }, __( 'This lesson is not published to Plato yet.', 'agentic-coach' ) )
							: null
					),
					el(
						PanelBody,
						{ title: __( 'Display', 'agentic-coach' ), initialOpen: false },
						el( ToggleControl, {
							label: __( 'Compact layout', 'agentic-coach' ),
							checked: attributes.layout === 'compact',
							onChange: function ( on ) {
								setAttributes( { layout: on ? 'compact' : 'full' } );
							},
						} ),
						el( TextControl, {
							label: __( 'Heading', 'agentic-coach' ),
							value: attributes.heading,
							onChange: function ( v ) { setAttributes( { heading: v } ); },
						} ),
						el( TextControl, {
							label: __( 'Intro text', 'agentic-coach' ),
							value: attributes.intro,
							onChange: function ( v ) { setAttributes( { intro: v } ); },
						} )
					)
				),
				el(
					'div',
					{ className: 'agentic-coach-editor-preview' },
					el( 'span', { className: 'agentic-coach-editor-preview__icon', 'aria-hidden': 'true' }, '🎓' ),
					el(
						'div',
						{},
						el( 'strong', {}, attributes.heading || __( 'Agentic Coach', 'agentic-coach' ) ),
						el(
							'p',
							{},
							attributes.lessonId
								? __( 'A Plato coach will be embedded here for the selected lesson.', 'agentic-coach' )
								: __( 'Choose a course and lesson in the block settings.', 'agentic-coach' )
						)
					)
				)
			);
		},
		save: function () {
			// Dynamic block — rendered in PHP.
			return null;
		},
	} );
} )( window.wp );
