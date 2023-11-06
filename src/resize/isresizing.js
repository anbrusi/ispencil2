// isresizing.js

import { Plugin } from '@ckeditor/ckeditor5-core';
import { Template } from '@ckeditor/ckeditor5-ui';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';

export default class IsResizing extends Plugin {

    init() {
        const domDocument = global.window.document;

        /**
         * This is the current widget on which the methods of this class act
         */
        this._widgetViewElement = null;

        /**
         * The last selected widget model element or null. Used to hide resizer on no longer selected widgets
         */
        this._selectedModelElement = null;

        /**
         * true if a resizer is active, false else
         */
        this._activeResizer = false;

        /**
         * One of 'left' or 'right' if a resizer is active, depending on which handle made it active
         */
        this._handlePosition = null;

        /**
         * The reference size (initial size) during resizing
         */
        this._originalResizerSize; 

        /**
         * The current resizer size. This will be taken as new size on mouseup in resizing
         */
        this._proposedSize;

        /**
         * this.showResizer sets this.lastSelectedModelElement to the displayed element and this.hideResizer resets it to null
         */
        this.lastSelectedModelElement = null;

        this._observer = new (DomEmitterMixin())();

        // Resizer dimensions and visibility must be set in a selection handler and not as a reaction
        // to canvas mouse clicks, because a click on a positioning handle would not handle the resizer
        this.editor.editing.downcastDispatcher.on( 'selection', (evt, data) => {
            // console.log( 'IsResizing#onSelectionHandler event', evt );
            // console.log( 'IsResizing#onSelectionHandler data', data );
            const selectedModelElement = data.selection.getSelectedElement();
            if ( selectedModelElement?.name == 'isPencil' ) {
                if ( this._selectedModelElement ) {
                    // There was an old selected model element. Hide the resizer
                    console.log( 'IsResizing#selectionHandler (widget selected) hide resizer in possibly old model element', this._selectedModelElement );
                    this.hideResizer( this._selectedModelElement);
                }
                // A new model element is selected. Sync and show the resizer
                // console.log( 'IsResizing#selectionHandler (widget selected) sync and show resizer in selected model element', selectedModelElement );
                this.syncResizerDim( selectedModelElement );
                this.showResizer( selectedModelElement);
                this._selectedModelElement = selectedModelElement;
            } else {
                // Deselect only
                if ( this._selectedModelElement ) {
                    // console.log( 'IsResizing#selectionHandler (no widget selected) hide old resizer in model element', this._selectedModelElement );
                    this.hideResizer( this._selectedModelElement );
                }
            }
        } );


        this._boundPointerdownHL = this._pointerdownHL.bind( this );
        this._boundPointermoveHL = this._pointermoveHL.bind( this );
        this._boundPointerupHL = this._pointerupHL.bind( this );

        /*
        this.editor.editing.view.on( 'render', () => { 
            const selectedViewElement = this.editor.editing.mapper.toViewElement( this._selectedModelElement);
            if ( selectedViewElement ) {
               this._attachHandleListeners( selectedViewElement );
            }
        } );
        */


        // The following worked with mouse, but not with pointer. Even changing only mousedown to pointerdown caused dragging of the whole widget
        /*
        this.listenTo( this.editor.editing.view.document, 'mousedown', this._pointerDownListener.bind( this ), { priority: 'high' } );
        this._observer.listenTo(domDocument, 'mousemove', this._pointerMoveListener.bind(this));
        this._observer.listenTo(domDocument, 'mouseup', this._pointerUpListener.bind(this));
        */

    }

    _pointerdownHL( domEvent ) {
        console.log( 'POINTERDOWN IsResizing pointerdown on handle event', domEvent );
        domEvent.preventDefault();

        // This is vital. Capturing the pointer retargets all future pointer events to handle until pointerup.
        // Without this measure, we would have to listen on document for pointermove,
        // but this could interfere with other move handlers, obliging us to add and remove handlers
        // See Ilya Kantor p. 189
        const handle = domEvent.target;
        handle.setPointerCapture( domEvent.pointerId );

        this._activeResizer = true;
        this._handlePosition = handlePosition( handle );
        this._originalCoordinates = extractCoordinates(domEvent);
        this._originalResizerSize = this._getResizerSize();

        console.log( 'original coordinates', this._originalCoordinates );
        const position = this._selectedModelElement.getAttribute( 'position');
        console.log( 'poition', position );
    }

    _pointermoveHL( domEvent ) {
        // console.log( 'POINTERMOVE IsResizing pointerdown on handle event', evt );
        if ( this._activeResizer && this._selectedModelElement ) {
            domEvent.preventDefault();
            const position = this._selectedModelElement.getAttribute( 'position');
            const selectedWidgetElement = this.editor.editing.mapper.toViewElement( this._selectedModelElement );
            const resizerViewElement = this.getChildByClass( selectedWidgetElement, 'ck-widget__resizer' );
            const newCoordinates = extractCoordinates(domEvent);
            this._proposedSize = this._proposeNewSize( position,  newCoordinates );
            console.log( 'proposedSize', this._proposedSize );
            this.editor.editing.view.change( (writer) => {
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  selectedWidgetElement );
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  resizerViewElement )
            } );
        }
    }

    _pointerupHL( domEvent ) {
        console.log( 'POINTERUP IsResizing pointerup on handle event', domEvent );
        domEvent.preventDefault();
        if ( this._activeResizer ) {
            // console.log ( 'new size on mouseup', this._proposedSize );
            this._activeResizer = false;
            const canvasModelElement = this._selectedModelElement.getChild(0);
            this.editor.model.change( writer => {
                writer.setAttributes({
                    height: this._proposedSize.height,
                    width: this._proposedSize.width
                }, canvasModelElement );
            } );
        }
    }

    _attachHandleListeners( widgetViewElement ) {
        // console.log( 'IsResizing editingView rendering selected view element', widgetViewElement );
        const children = widgetViewElement.getChildren();
        for ( let child of children ) {
            if (child.hasClass( 'ck-widget__resizer') ) {
                console.log( 'resizer', child );
                const domResizerElement = this.editor.editing.view.domConverter.mapViewToDom( child );
                console.log( 'domResizerElement', domResizerElement );
                if ( domResizerElement ) {
                    const resizerChildren = domResizerElement.children; // a HTML collection
                    for ( let child of resizerChildren ) {
                        if ( child.classList.contains( 'ck-widget__resizer__handle' ) ) {
                            // console.log( 'resizer__handle', child );

                            child.addEventListener( 'pointerdown', this._boundPointerdownHL );
                            child.addEventListener( 'pointermove', this._boundPointermoveHL );
                            child.addEventListener( 'pointerup', this._boundPointerupHL );

                            /*
                            this._observer.listenTo( child, 'pointerdown', this._boundPointerdownHL );
                            this._observer.listenTo( child, 'pointermove', this._boundPointermoveHL );
                            this._observer.listenTo( child, 'pointerup', this._boundPointerupHL );
                            */

                            // If contextmenu is not disabled and the pointer is hovered over the handle in isPad, the context menu is opened.
                            // On Mac the context menu would be opened, by right clicking on the handle, but this is disabled as well
                            child.addEventListener( 'contextmenu', e => e.preventDefault() );
                        }
                    }
                }
            }
        }
    }

    /**
     * Called in IsPencilEditing to greate the resizer div and the resizer handles.
     * The resultin resizerViewElement is hot yet available at the end of this method, but only at editing downcast completion
     * 
     * @param {*} viewWriter 
     * @param {string} position IsPencil position of the widget. One of 'left', 'cente', 'right'
     * @returns 
     */
    createResizer( viewWriter, position ) {
        const resizerViewElement = viewWriter.createUIElement('div', {
            class: 'ck ck-reset_all ck-widget__resizer'
        }, function (domDocument) {
            const domElement = this.toDomElement(domDocument); // Creates DOM element based on this view UIElement
            // domElement is the just created resizer div in the dom
            console.log( 'custom render function domElement', domElement );
            let rightHandle = new Template( {
                tag: 'div',
                attributes: {
                    class: 'ck-widget__resizer__handle ck-widget__resizer__handle-bottom-right'
                }                
            } ).render();
            rightHandle.style['touch-action'] = 'none';
            let leftHandle = new Template( {
                tag: 'div',
                attributes: {
                    class: 'ck-widget__resizer__handle ck-widget__resizer__handle-bottom-left'
                }
            } ).render();
            leftHandle.style['touch-action'] = 'none';
            switch ( position ) {
                case 'left':
                    domElement.appendChild( rightHandle );
                    break;
                case 'right':                    
                    domElement.appendChild( leftHandle );
                    break;
                case 'center':             
                    domElement.appendChild( leftHandle );
                    domElement.appendChild( rightHandle );
            }
            let rubberLine = new Template( {
                tag: 'div',
                attributes: {
                    class: 'ispcl-rubber-line',
                    style: {
                        border: '2px solid green',
                        position: 'absolute',
                        width: '0px',
                        height: '0px',
                        display: 'none'
                    }
                }
            } ).render();
            domElement.appendChild( rubberLine );
            return domElement;
        } );
        return resizerViewElement;
    }

    /**
     * Syncs resizer width and height to canvas width and height in widgetModelElement
     * If widgetModelElement === null, this method has no effect
     * 
     * @param {@ckeditor/ckeditor5-engine/src/model/element} widgetModelElement 
     */
    syncResizerDim( widgetModelElement ) {
        if ( widgetModelElement ) {
            const widgetViewElement = this.editor.editing.mapper.toViewElement( widgetModelElement )
            const canvasViewElement = this.getChildByClass( widgetViewElement, 'ispcl-canvas' );
            const resizerViewElement = this.getChildByClass( widgetViewElement, 'ck-widget__resizer' );
            console.log( 'IsResizing#syncResizerDim resizerViewElement', resizerViewElement );
            if ( canvasViewElement && resizerViewElement ) {
                this.editor.editing.view.change( viewWriter => {
                    let width = canvasViewElement.getAttribute( 'width' ) + 'px';
                    let height = canvasViewElement.getAttribute( 'height' ) + 'px';
                    viewWriter.setStyle('width', width, resizerViewElement );
                    viewWriter.setStyle( 'height', height, resizerViewElement );
                } );
            }
        }
    }

    /**
     * Shows the resizer if this.widgetViewElement != null, has no effect else
     */

    /**
     * 
     * @param {@ckeditor/ckeditor5-engine/src/model/element} widgetModelElement 
     */
    showResizer( widgetModelElement ) {
        const widgetViewElement = this.editor.editing.mapper.toViewElement( widgetModelElement );
        if ( widgetViewElement ) {
            const resizerViewElement = this.getChildByClass( widgetViewElement, 'ck-widget__resizer' );
            // console.log( 'IsResizing#showResizer resizerViewElement', resizerViewElement );
            if ( resizerViewElement && resizerViewElement.getStyle( 'display ') != 'block' ) {
                const displayStyle = resizerViewElement.getStyle( 'display ');
                console.log( 'displayStyle', displayStyle );
                this.editor.editing.view.change( viewWriter => {
                    viewWriter.setStyle( 'display', 'block', resizerViewElement );
                    this._attachHandleListeners( widgetViewElement );
                } );
            }
        }
        this.lastSelectedModelElement = widgetModelElement;
    }

    /**
     * Hides the resizer if widgetModelElement != null, has no effect else
     * 
     * @param {@ckeditor/ckeditor5-engine/src/model/element} widgetModelElement 
     */
    hideResizer( widgetModelElement ) {
        const widgetViewElement = this.editor.editing.mapper.toViewElement( widgetModelElement )
        const resizerViewElement = this.getChildByClass( widgetViewElement, 'ck-widget__resizer' );
        console.log( 'IsResizing#hideResizer resizerViewElement', resizerViewElement );
        if ( resizerViewElement ) {
            this.editor.editing.view.change( viewWriter => {
                viewWriter.setStyle( 'display', 'none', resizerViewElement );
            } );
        }
        this.lastSelectedModelElement = null;
    }

    /**
     * Returns a child of viewElement with class name className or null if there is none
     * 
     * @param {@ckeditor/ckeditor5-engine/src/view/element} viewElement 
     * @param {string} className 
     * @returns 
     */
    getChildByClass(viewElement, className ) {
        if ( viewElement ) {
            const children = viewElement.getChildren();
            for ( let child of children ) {
                if ( child.hasClass( className ) ) {
                    return child;
                }
            }
        }
        return null;
    }

    /**
     * Callback to an observeble
     * 
     * @param {*} event 
     * @param {*} domEventData 
     */
    /*
    _pointerDownListener( event, domEventData ) {
        const domTarget = domEventData.domTarget;
        // console.log( 'isresizing mouse down on target', domTarget );
        if ( isResizerHandle( domTarget ) ) {
            // console.log( 'clicked handle' );
            event.stop(); // Stops the event emitter to call further callbacks for this event interaction.
            domEventData.preventDefault();
            this._activeResizer = true;
            this._handlePosition = handlePosition( domTarget );
            this._originalCoordinates = extractCoordinates(domEventData.domEvent);
            this._originalResizerSize = this._getResizerSize();
        }
    }
    */

    /*
    _pointerUpListener( event, domEventData ) {
        if ( this._activeResizer ) {
            // console.log ( 'new size on mouseup', this._proposedSize );
            this._activeResizer = false;
            const canvasModelElement = this._selectedModelElement.getChild(0);
            this.editor.model.change( writer => {
                writer.setAttributes({
                    height: this._proposedSize.height,
                    width: this._proposedSize.width
                }, canvasModelElement );
            } );
        }
    }
    */

    /**
     * Callback to a DomEmitterMixin
     * 
     * @param {*} event 
     * @param {*} domEventData 
     */
    /*
    _pointerMoveListener( event, domEventData ) {
        if ( this._activeResizer && this._selectedModelElement ) {
            domEventData.preventDefault();
            const position = this._selectedModelElement.getAttribute( 'position ')
            const selectedWidgetElement = this.editor.editing.mapper.toViewElement( this._selectedModelElement );
            const resizerViewElement = this.getChildByClass( selectedWidgetElement, 'ck-widget__resizer' );
            const newCoordinates = extractCoordinates(domEventData);
            this._proposedSize = this._proposeNewSize( position,  newCoordinates );
            console.log( 'proposedNewSize', this._proposedSize );
            this.editor.editing.view.change( (writer) => {
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  selectedWidgetElement );
                writer.setStyle( {
                    width: this._proposedSize.width + 'px',
                    height: this._proposedSize.height + 'px'
                },  resizerViewElement )
            } );
        }
    }
    */

   _getResizerSize ( ) {
        const selectedViewElement = this.editor.editing.mapper.toViewElement( this._selectedModelElement )
        const resizerViewElement = this.getChildByClass( selectedViewElement, 'ck-widget__resizer' );
        if ( resizerViewElement ) {
            return {
                width: parseInt( resizerViewElement.getStyle( 'width' ) ),
                height: parseInt( resizerViewElement.getStyle( 'height' ) )
            }
        }
    }

    /**
     * Returns the size of the resizer from page coordinates 'newCoordinates' of the mouse
     * if the model attribute position is 'center' the widget increases to the left and the right,
     * so incremental mouse movements count twice for the width
     * 
     * @param {string} position
     * @param {point} newCoordinates 
     * @returns 
     */
    _proposeNewSize( position, newCoordinates ) {
        let dx = newCoordinates.x - this._originalCoordinates.x;
        let dy = newCoordinates.y - this._originalCoordinates.y;
        if ( this._handlePosition == 'left' ) {
            dx = - dx;
        }
        if ( position == 'center' ) {
            dx *= 2;
        }
        let newSize = {
            width: this._originalResizerSize.width + dx,
            height: this._originalResizerSize.height + dy
        }
        return newSize;
    }
}

function isResizerHandle( domElement ) {
    return domElement?.classList.contains( 'ck-widget__resizer__handle' );
}

/**
 * Returns one of 'left', 'right' if domElement is a resizer handle, null if it is not
 * 
 * @param {HTML dom element} domElement 
 * @returns 
 */
function handlePosition( domElement ) {
    if ( domElement?.classList.contains( 'ck-widget__resizer__handle-bottom-left' ) ) {
        return 'left';
    }
    if ( domElement?.classList.contains( 'ck-widget__resizer__handle-bottom-right' ) ) {
        return 'right';
    }
    return null;
}

/**
 * Returns mouse page coordinates from a maouse event 'event'
 * 
 * @param {dom mouse event} event 
 * @returns 
 */
function extractCoordinates(event) {
    return {
        x: event.pageX,
        y: event.pageY
    };
}