/**
 * Authoring sidebar: lightweight AI help while writing a coaching lesson.
 *
 * Uses WordPress's native PHP AI Client via the plugin's /author-coach REST
 * proxy. The full agentic coaching experience lives in Plato.
 *
 * @package AgenticCoach
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var __ = wp.i18n.__;
	var apiFetch = wp.apiFetch;
	var select = wp.data.select;
	var useEntityProp = wp.coreData.useEntityProp;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginSidebar = wp.editPost.PluginSidebar;
	var PluginSidebarMoreMenuItem = wp.editPost.PluginSidebarMoreMenuItem;
	var TextareaControl = wp.components.TextareaControl;
	var Button = wp.components.Button;
	var Spinner = wp.components.Spinner;
	var Notice = wp.components.Notice;

	function CoachingFields() {
		var postType = select( 'core/editor' ).getCurrentPostType();
		var metaProp = useEntityProp( 'postType', postType || 'post', 'meta' );
		var meta = metaProp[ 0 ] || {};
		var setMeta = metaProp[ 1 ];
		function update( key, value ) {
			var next = Object.assign( {}, meta );
			next[ key ] = value;
			setMeta( next );
		}
		return el(
			'div',
			{ style: { padding: '16px', borderBottom: '1px solid #e0e0e0' } },
			el( 'p', {}, __( 'Define what the coach helps the learner achieve. This is sent to Plato when you publish.', 'agentic-coach' ) ),
			el( TextareaControl, {
				label: __( 'Learning objectives (one per line)', 'agentic-coach' ),
				value: meta._agentic_objectives || '',
				onChange: function ( v ) { update( '_agentic_objectives', v ); },
				rows: 3,
			} ),
			el( TextareaControl, {
				label: __( 'Exemplar (the mastery outcome the learner produces)', 'agentic-coach' ),
				value: meta._agentic_exemplar || '',
				onChange: function ( v ) { update( '_agentic_exemplar', v ); },
				rows: 3,
			} ),
			el( TextareaControl, {
				label: __( 'Coach directive (optional runtime guidance)', 'agentic-coach' ),
				value: meta._agentic_coach_directive || '',
				onChange: function ( v ) { update( '_agentic_coach_directive', v ); },
				rows: 2,
			} )
		);
	}

	function PublishToPlato() {
		var busyState = useState( false );
		var busy = busyState[ 0 ];
		var setBusy = busyState[ 1 ];
		var msgState = useState( null );
		var msg = msgState[ 0 ];
		var setMsg = msgState[ 1 ];

		function publish() {
			setBusy( true );
			setMsg( null );
			var postId = select( 'core/editor' ).getCurrentPostId();
			apiFetch( {
				path: '/agentic-coach/v1/publish-lesson',
				method: 'POST',
				data: { postId: postId },
			} )
				.then( function ( data ) {
					setMsg( {
						status: 'success',
						text: data && data.courseLinked
							? __( 'Published to Plato and linked to its course — cross-lesson memory will span this course.', 'agentic-coach' )
							: __( 'Published to Plato. Assign this lesson to a course so the coach remembers across lessons.', 'agentic-coach' ),
					} );
				} )
				.catch( function ( err ) {
					setMsg( { status: 'error', text: ( err && err.message ) || __( 'Publish failed.', 'agentic-coach' ) } );
				} )
				.finally( function () {
					setBusy( false );
				} );
		}

		return el(
			'div',
			{ style: { padding: '16px', borderBottom: '1px solid #e0e0e0' } },
			el( 'p', {}, __( 'Push this lesson to Plato so it can be embedded and coached.', 'agentic-coach' ) ),
			el(
				Button,
				{ variant: 'secondary', onClick: publish, disabled: busy },
				busy ? el( Spinner, {} ) : __( 'Publish to Plato', 'agentic-coach' )
			),
			msg ? el( Notice, { status: msg.status, isDismissible: false }, msg.text ) : null
		);
	}

	function SidebarContent() {
		var promptState = useState( '' );
		var prompt = promptState[ 0 ];
		var setPrompt = promptState[ 1 ];

		var busyState = useState( false );
		var busy = busyState[ 0 ];
		var setBusy = busyState[ 1 ];

		var resultState = useState( '' );
		var result = resultState[ 0 ];
		var setResult = resultState[ 1 ];

		var errorState = useState( '' );
		var error = errorState[ 0 ];
		var setError = errorState[ 1 ];

		function ask() {
			setBusy( true );
			setError( '' );
			setResult( '' );
			apiFetch( {
				path: '/agentic-coach/v1/author-coach',
				method: 'POST',
				data: { prompt: prompt },
			} )
				.then( function ( data ) {
					setResult( ( data && data.text ) || '' );
				} )
				.catch( function ( err ) {
					setError( ( err && err.message ) || __( 'Request failed.', 'agentic-coach' ) );
				} )
				.finally( function () {
					setBusy( false );
				} );
		}

		return el(
			'div',
			{ style: { padding: '16px' } },
			el( 'p', {}, __( 'Ask for help drafting objectives, an exemplar, or a coach directive.', 'agentic-coach' ) ),
			el( TextareaControl, {
				label: __( 'Your request', 'agentic-coach' ),
				value: prompt,
				onChange: setPrompt,
				rows: 4,
			} ),
			el(
				Button,
				{ variant: 'primary', onClick: ask, disabled: busy || ! prompt },
				busy ? el( Spinner, {} ) : __( 'Ask the coach', 'agentic-coach' )
			),
			error ? el( Notice, { status: 'error', isDismissible: false }, error ) : null,
			result
				? el(
					'div',
					{ style: { marginTop: '12px', whiteSpace: 'pre-wrap' }, role: 'region', 'aria-label': __( 'Coach suggestion', 'agentic-coach' ) },
					result
				)
				: null
		);
	}

	registerPlugin( 'agentic-coach-sidebar', {
		render: function () {
			return el(
				wp.element.Fragment,
				{},
				el(
					PluginSidebarMoreMenuItem,
					{ target: 'agentic-coach-sidebar' },
					__( 'WordPress Coach', 'agentic-coach' )
				),
				el(
					PluginSidebar,
					{ name: 'agentic-coach-sidebar', title: __( 'WordPress Coach', 'agentic-coach' ) },
					el( wp.element.Fragment, {}, el( CoachingFields, {} ), el( PublishToPlato, {} ), el( SidebarContent, {} ) )
				)
			);
		},
	} );
} )( window.wp );
