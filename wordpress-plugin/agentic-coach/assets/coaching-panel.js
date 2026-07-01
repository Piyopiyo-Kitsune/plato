/**
 * "Coaching content" document settings panel: the lesson's Learning Objectives,
 * Exemplar, and an optional Coach Directive. Shown in the editor's document
 * sidebar for WordPress Coach lessons and (when active) Sensei lessons.
 *
 * Bound to post meta via useEntityProp, so it saves with the post. These values
 * are what get sent to Plato when the lesson is published.
 *
 * @package AgenticCoach
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var useSelect = wp.data.useSelect;
	var useEntityProp = wp.coreData.useEntityProp;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel =
		( wp.editor && wp.editor.PluginDocumentSettingPanel ) ||
		( wp.editPost && wp.editPost.PluginDocumentSettingPanel );
	var TextareaControl = wp.components.TextareaControl;

	// Max length for the lesson-card excerpt (~two lines on the card).
	var EXCERPT_MAX = 160;

	function Panel() {
		var postType = useSelect( function ( s ) {
			return s( 'core/editor' ).getCurrentPostType();
		}, [] );
		var metaProp = useEntityProp( 'postType', postType || 'post', 'meta' );
		var meta = metaProp[ 0 ] || {};
		var setMeta = metaProp[ 1 ];

		if ( ! PluginDocumentSettingPanel || ( 'agentic_lesson' !== postType && 'lesson' !== postType ) ) {
			return null;
		}

		function update( key, value ) {
			var next = Object.assign( {}, meta );
			next[ key ] = value;
			setMeta( next );
		}

		var excerpt = meta._agentic_excerpt || '';
		var excerptRemaining = EXCERPT_MAX - excerpt.length;

		return el(
			PluginDocumentSettingPanel,
			{ name: 'agentic-coach-content', title: __( 'Coaching content', 'agentic-coach' ) },
			el( 'p', { style: { marginTop: 0 } }, __( 'What the coach guides the learner to achieve. Sent to Plato when you publish.', 'agentic-coach' ) ),
			el( TextareaControl, {
				label: __( 'Lesson excerpt', 'agentic-coach' ),
				help: sprintf(
					/* translators: %d: number of characters remaining. */
					__( 'A short summary shown on the lesson card. %d characters left.', 'agentic-coach' ),
					excerptRemaining
				),
				value: excerpt,
				maxLength: EXCERPT_MAX,
				onChange: function ( v ) { update( '_agentic_excerpt', v.slice( 0, EXCERPT_MAX ) ); },
				rows: 2,
			} ),
			el( TextareaControl, {
				label: __( 'Learning objectives', 'agentic-coach' ),
				help: __( 'One per line — 2 to 4 works best.', 'agentic-coach' ),
				value: meta._agentic_objectives || '',
				onChange: function ( v ) { update( '_agentic_objectives', v ); },
				rows: 4,
			} ),
			el( TextareaControl, {
				label: __( 'Exemplar', 'agentic-coach' ),
				help: __( 'The mastery-level outcome the learner should produce.', 'agentic-coach' ),
				value: meta._agentic_exemplar || '',
				onChange: function ( v ) { update( '_agentic_exemplar', v ); },
				rows: 4,
			} ),
			el( TextareaControl, {
				label: __( 'Coach directive (optional)', 'agentic-coach' ),
				help: __( 'Extra runtime guidance for the coach, e.g. “reference the learner’s site”.', 'agentic-coach' ),
				value: meta._agentic_coach_directive || '',
				onChange: function ( v ) { update( '_agentic_coach_directive', v ); },
				rows: 2,
			} )
		);
	}

	registerPlugin( 'agentic-coach-content', { render: Panel } );
} )( window.wp );
