/**
 * Front-end runtime for the WordPress Coach block.
 *
 * Fetches a single-use embed URL from the WordPress REST proxy (which talks to
 * Plato server-side, so no secret is exposed), then mounts a sandboxed iframe
 * and resizes it to the height Plato reports via postMessage.
 *
 * @package AgenticCoach
 */
( function () {
	'use strict';

	function originOf( url ) {
		try {
			return new URL( url ).origin;
		} catch ( e ) {
			return '';
		}
	}

	function setStatus( mount, message, isError ) {
		var status = mount.querySelector( '.agentic-coach__status' );
		if ( ! status ) {
			return;
		}
		status.textContent = message;
		if ( isError ) {
			status.setAttribute( 'role', 'alert' );
		}
	}

	function mountCoach( mount ) {
		var platoUrl = mount.getAttribute( 'data-plato-url' );
		var lessonId = mount.getAttribute( 'data-lesson' );
		var endpoint = mount.getAttribute( 'data-endpoint' );
		var nonce = mount.getAttribute( 'data-nonce' );
		var frameTitle = mount.getAttribute( 'data-frame-title' ) || 'WordPress Coach';
		var platoOrigin = originOf( platoUrl );

		fetch( endpoint, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			body: JSON.stringify( { lessonId: lessonId } ),
		} )
			.then( function ( res ) {
				if ( ! res.ok ) {
					throw new Error( 'embed-token request failed' );
				}
				return res.json();
			} )
			.then( function ( data ) {
				if ( ! data || ! data.embedUrl ) {
					throw new Error( 'no embed url' );
				}
				renderIframe( mount, data.embedUrl, frameTitle, platoOrigin );
			} )
			.catch( function () {
				setStatus( mount, 'The coach is unavailable right now. Please reload the page.', true );
			} );
	}

	function renderIframe( mount, embedUrl, frameTitle, platoOrigin ) {
		var iframe = document.createElement( 'iframe' );
		iframe.className = 'agentic-coach__frame';
		iframe.title = frameTitle;
		iframe.src = embedUrl;
		iframe.setAttribute( 'loading', 'lazy' );
		iframe.setAttribute( 'allow', 'clipboard-write' );
		// Same-origin is needed for Plato's own app state; scripts/forms for chat.
		iframe.setAttribute( 'sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups' );
		iframe.style.width = '100%';
		iframe.style.border = '0';

		// Fixed, viewport-bounded height. The coach scrolls INSIDE the iframe, so a
		// streaming reply never scrolls the host page. (A full-height iframe has no
		// internal scroll, which is what made the page jump as the coach typed.)
		var applyHeight = function () {
			var vh = window.innerHeight || 800;
			iframe.style.height = Math.max( 480, Math.min( 720, Math.round( vh * 0.8 ) ) ) + 'px';
		};
		applyHeight();
		window.addEventListener( 'resize', applyHeight );

		var status = mount.querySelector( '.agentic-coach__status' );
		if ( status ) {
			status.parentNode.removeChild( status );
		}
		mount.appendChild( iframe );
	}

	function init() {
		var mounts = document.querySelectorAll( '.agentic-coach__mount' );
		Array.prototype.forEach.call( mounts, mountCoach );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
