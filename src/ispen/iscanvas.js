// ispen/iscanvas.js

import { Plugin } from '@ckeditor/ckeditor5-core';
import { DomEmitterMixin, global } from '@ckeditor/ckeditor5-utils';
import { logError } from '@ckeditor/ckeditor5-utils/src/ckeditorerror';
import IsPencilEditing from '../ispencilediting';
// import { refreshCanvas } from '../ispen/ispenengine';
import { IsPenEngine } from '../ispen/ispenengine';

export default class IsCanvas extends Plugin {

    /**
     * The structure of data in the JSON od data-ispcl-content is
     * 
     * - segmentArray an array of segments
     *      - segment is an object with properties 'width', 'color' 'stepType', 'pts'
     */

    /**
     * Event handling
     * ==============
     * 
     * The starting point of event handling is 'this._pointerdownListener', which is attached to the whole dom document.
     * Depending on pointer position the following case are handled:
     *      - 1. outside CKEditor
     *      - 2. in CKEditor but outside of any IsPencil canvas
     *      - 3. on canvas, which is not current
     *      - 4. on current canvas
     * 
     * case 3.
     * A new canvas becomes the current canvas on which we work.
     * The drawing relevant listeners 'this._pointerdownHL', 'this._poinermoveHL', 'this._pointerupHL' are attached by 'this._attachCanvasListeners'.
     * These are generic listener used for all modes. For the real work they call the methods 'this._pointerdownM', 'this._pointermoveM', 'this._pointerupM',
     * which are replaced by mode specific methods. They are initialized to the default mode 'freePen' and replaced on mode change by 'this.changeMode'.
     * 
     * Note:
     * Only the first pointerdown, which attaches drawing listeners, is made by 'this._pointerdownListener', which for the purpse calls 'this_pointerdownHL'.
     * For subsequent pointerdown events 'this._pointerdownHL', attached directly to the canvas is used.
     */
    static get pluginName() {
        return 'IsCanvas';
    }

    init() {
        console.log( 'IsCanvas#init' );
        const domDocument = global.window.document;
        // Plugins are Observable, but this.ListenTo would not do, since we need a DomEmitterMixin, not just a an EmitterMixin
        // DOM emitter mixin is by default available in the View class, but it can also be mixed into any other class:
        this._observer = new (DomEmitterMixin())();

        this._observer.listenTo( domDocument, 'pointerdown', this._pointerdownListener.bind( this ) );

        this.isPencilEditing = this.editor.plugins.get( IsPencilEditing );

        /**
         * This is the canvas model element after a pointer down on its canvas has been processed
         */
        this._currentCanvasModelElement = null;

        // These default methods are replaced by 'this.changeMode'
        this._pointerdownM = this._freePenPointerdownM;
        this._pointermoveM = this._freePenPointermoveM;
        this._pointerupM = this._freePenPointerupM;

        // The following are initial values, current values are set 
        this.mode = 'freePen'
        this.color = 'black';
        this.stroke = 'medium';

        // The pointer is down on a canvas for ispencil use
        this.pointerDown = false;

        const options = {};
        this.isPenEngine = new IsPenEngine( options );
    }

    _modelToView( modelElement ) {
        if ( modelElement ) {
            return this.editor.editing.mapper.toViewElement( modelElement );
        } else {
            return undefined;
        }
    }

    _viewToDom( viewElement ) {
        if ( viewElement ) {
            return this.editor.editing.view.domConverter.viewToDom( viewElement );
        } else {
            return undefined;
        }
    }

    _modelToDom( modelElement ) {
        const viewElement = this._modelToView( modelElement );
        return this._viewToDom( viewElement );
    }

    _currentCanvasDomElement() {
        const currentCanvasViewElement = this.editor.editing.mapper.toViewElement( this._currentCanvasModelElement);
        if ( currentCanvasViewElement ) {
            return this.editor.editing.view.domConverter.viewToDom( currentCanvasViewElement );
        }
        return null;
    }

    /**
     * 
     * @returns the current resizerViewElement derived from this._currentCanvasModelElement or null
     */
    _currentResizerViewElement() {
        const currentCanvasViewElement = this.editor.editing.mapper.toViewElement( this._currentCanvasModelElement);
        if ( currentCanvasViewElement ) {
            const currentWidgetViewElement = currentCanvasViewElement.parent;
            const children = currentWidgetViewElement.getChildren();
            for ( let child of children ) {
                if ( child.hasClass( 'ck-widget__resizer' ) ) {
                    return child;
                }
            }
        }
        return null;
    }

    _currentResizerDomElement() {
        const currentResizerViewElement = this._currentResizerViewElement();
        if (currentResizerViewElement ) {
            return this.editor.editing.view.domConverter.viewToDom( currentResizerViewElement );
        }
        return null;
    }

    /**
     * 
     * @returns the current rubber line dom element or null
     */
    _currentRubberDomElement() {
        const currentResizerViewElement = this._currentResizerViewElement();
        const currentResizerDomElement = this.editor.editing.view.domConverter.mapViewToDom( currentResizerViewElement );
        for ( let child of currentResizerDomElement.children ) {
            if ( child.classList.contains( 'ispcl-rubber-line' ) ) {
                return child;
            }
        }
        return null;
    }

    /**
     * Maps a HTML DOM Element to a CKEDITOR model element.
     * 
     * @param {HTML DOM element} domElement 
     * @returns 
     */
    domToModel( domElement ) {
        // dom to view
        const viewElement = this.editor.editing.view.domConverter.mapDomToView( domElement );
        if ( viewElement ) {
            // view to model
            const modelElement = this.editor.editing.mapper.toModelElement( viewElement );
            if ( modelElement ) {
                return modelElement;
            }
        }
    }

    /**
     * Called in IsPencilUI when the mode observable changes
     * 
     * @param {string} newMode 
     */
    changeMode( newMode ) {
        console.log( 'IsCanvas mode changed to', newMode );
        switch (newMode) {
            case 'freePen':
                this._pointerdownM = this._freePenPointerdownM;
                this._pointermoveM = this._freePenPointermoveM;
                this._pointerupM = this._freePenPointerupM;
                break;
            case 'straightLines':
                this._pointerdownM = this._straightLinesPointerdownM;
                this._pointermoveM = this._straightLinesPointermoveM;
                this._pointerupM = this._straightLinesPointerupM
                break;
            case 'erase':
                this._pointerdownM = this._erasePointerDownM;
                this._pointermoveM= this._erasePointerMoveM;
                this._pointerupM = this._erasePointerUpM;
        }
        this.mode = newMode;
    }

    /**
     * Called in IsPencilUi when the color changes
     * 
     * @param {string} newColor 
     */
    changeColor( newColor ) {
        this.color = newColor;
        if (this._currentCanvasModelElement) {
            this.ctx.strokeStyle = this.color;
        }
    }

    /**
     * Called in IsPencilUi when the stroke width changes. 
     * newStroke is one of the witdth names enumerated in _lineWidthFromStroke
     * 
     * @param {string} newStroke 
     */
    changeStroke( newStroke ) {
        this.stroke = newStroke;
        if (this._currentCanvasModelElement) {
            this.ctx.lineWidth = _lineWidthFromStroke( this.stroke );
        }
    }

    /**
     * This listener is not modal. The first click selects the widget, since there is no preventDefault in the subsequent handler chain
     * There is no interference with moving the widget, because the default is prevented in the move chain.
     * Moving remains possible, because clck on the handle and subsequent motion does not pass through canvas native handlers
     * 
     * @param {*} event 
     * @param {native dom event} domEventData 
     */
    _pointerdownListener(event, domEventData) {
        console.log( 'pointer down ');
        // Usde for focusing and unfocusing the widget
        const view = this.editor.editing.view;
        const viewDocument = view.document;
        const srcElement = domEventData.srcElement;
        if ( this._srcInEditor( srcElement ) ) {
            // console.log( 'isCanvas#pointerdownListener source in editor ', srcElement );
            if (srcElement.hasAttribute( 'data-ispcl-content' )) {
                // Pointer down on canvas
                const canvasViewElement = this.editor.editing.view.domConverter.mapDomToView(srcElement);
                const canvasModelElement = this.editor.editing.mapper.toModelElement( canvasViewElement );

                // If we do not prevent default, mouse motion would drag the whole widget, as soon as the mouse leaves the widget area
                // If on the contrary we prevent default, clicking on the widget would not focus it,
                // The chosen method is to prevent default and focus the widget programmatically in this method, when it is clicked
                // Unfortunately focusing works only if the whole editor is focused, so we must make both: 
                // focus the editor if it is not already focused, and focus the widget
                domEventData.preventDefault();
                // Focus the editor. 
                // Focus editor if is not focused already. Outside the widget it is automatic, since there we do not prevent default
                if (!viewDocument.isFocused) {
                    view.focus();
                }
                // Focus the widget
                this.editor.model.change(writer => {
                    writer.setSelection(writer.createRangeOn(canvasModelElement.parent));
                });

                // Check if it is the current canvas
                if ( this._currentCanvasModelElement && 
                    canvasModelElement.getAttribute( 'uid') == this._currentCanvasModelElement.getAttribute( 'uid') ) {
                    // Pointer down on current canvas.
                    // ===============================
                    // Possibly the resizer has been hidden by clicking outside of the editor
                    this.isPencilEditing.isResizing.showResizer( canvasModelElement.parent );

                    // this._pointerDownH(event, domEventData);
                    // this._freePenPointerdownHL( domEventData );
                } else {
                    // Pointer down on a canvas, which is not current.
                    // ===============================================
                    // this._setCanvasListeners( canvasModelElement );
                    if ( this._currentCanvasModelElement ) {
                        // There was a previously open canvas
                        this.closeCanvas( this._currentCanvasModelElement );
                    }
                    this.isPenEngine.loadFromCanvas( srcElement );
                    this._currentCanvasModelElement = canvasModelElement;

                    // this._pointerDownH(event, domEventData);
                    this._attachCanvasListeners( this._currentCanvasModelElement );
                    console.log( 'calling canva pointerdown from document pointerdown' );
                    this._pointerdownHL( domEventData );
                }
            } else {
                // pointer down outside of canvas
                // ==============================
                console.log( 'IsCanvas#_pointerdownListener source element', srcElement );
                if ( this._currentCanvasModelElement ) {
                    // There was a previously open canvas
                    this.closeCanvas( this._currentCanvasModelElement );
                    this._currentCanvasModelElement = null;
                }
            }
        } else {
            // pointer down outside the editor
            // ===============================
            console.log( 'isCanvas#pointerdownListener source NOT in editor ', srcElement );
            // Hiding of the resizer is usually done in IsResizing on selection handler,
            // when the selection shifts away from the currently selected widget.
            // Outside of the editor there is no selection change and the resizer must be hidden outside of the selection handler
            if ( this.isPencilEditing.isResizing.lastSelectedModelElement ) {
                this.isPencilEditing.isResizing.hideResizer( this.isPencilEditing.isResizing.lastSelectedModelElement );
            }
            if ( this._currentCanvasModelElement ) {
                // There was a previously open canvas
                this.closeCanvas( this._currentCanvasModelElement );
                this._currentCanvasModelElement = null;
            }
        }

    }

    _attachCanvasListeners( canvasModelElement ) {
        const canvas = this._modelToDom( canvasModelElement );
        canvas.addEventListener( 'pointerdown', this._pointerdownHL.bind( this ) );
        canvas.addEventListener( 'pointermove', this._pointermoveHL.bind( this ) );
        canvas.addEventListener( 'pointerup', this._pointerupHL.bind( this ) );
        
        // If contextmenu is not disabled and the pointer is hovered over the handle in isPad, the context menu is opened.
        // On Mac the context menu would be opened, by right clicking on the handle, but this is disabled as well
        canvas.addEventListener( 'contextmenu', e => e.preventDefault() );
    }

    _pointerdownHL( evt ) {
        this._pointerdownM( evt );
    }

    _pointermoveHL( evt ) {
        this._pointermoveM( evt );
    }

    _pointerupHL( evt ) {
        this._pointerupM( evt );
    }

    _freePenPointerdownM( evt ) {
        console.log( 'free pen pointerdown fired on canvas' );
        evt.preventDefault();     
        if (this._allowedPointer(evt) && !this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = true;
            if (evt.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'crosshair';
            } else {
                canvasDomElement.style.cursor = 'none';
            }

            const width = _lineWidthFromStroke( this.stroke );  
            const startPos = this._domPos( canvasDomElement, evt );  
            this.isPenEngine.startPath( canvasDomElement, startPos, width, this.color, 'C' );
        }
        evt.stopPropagation();
    }

    _freePenPointermoveM( evt ) {
        console.log( 'pointermove fired on canvas', evt.pointerType );
        evt.preventDefault();
        if (this._allowedPointer(evt) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            const point = this._domPos(canvasDomElement, evt );
            this.isPenEngine.moveTo( point );
        }
    }

    _freePenPointerupM( evt ) {
        console.log( 'pointerup fired on canvas' );
        evt.preventDefault();   
        if (this._allowedPointer(evt) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = false;
            if (evt.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'default';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            const lastPoint = this._domPos( canvasDomElement, evt );
            this.isPenEngine.terminatePath( lastPoint );
        }
    }

    _straightLinesPointerdownM( evt ) {  
        console.log( 'straight lines pointerdown fired on canvas' );
        if (this._allowedPointer(evt) && !this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = true;
            if (evt.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'crosshair';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            const startPos = this._domPos( canvasDomElement, evt );  
            const width = _lineWidthFromStroke( this.stroke );   
            this.isPenEngine.startPath( canvasDomElement, startPos, width, this.color, 'L' );
            // Start the rubber line
            this._setRubberLineAnchor( startPos );
            this._showRubberLine();
        }
    }

    _straightLinesPointermoveM( evt ) {
        if (this._allowedPointer( evt ) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            let pos = this._domPos(canvasDomElement, evt );
            this._drawRubberLine( pos );
        }
    }

    _straightLinesPointerupM( evt ) {
        if (this._allowedPointer( evt ) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = false;
            if ( evt.pointerType == 'mouse' ) {
                canvasDomElement.style.cursor = 'default';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this._hideRubberLine();
            const lastPoint = this._domPos( canvasDomElement, evt );
            this.isPenEngine.terminatePath( lastPoint );
        }
    }


    _erasePointerDownM( evt ){
        console.log('erasePointerDown');
        if (this._allowedPointer(evt) && !this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = true;
            if (evt.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'crosshair';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            const pos = this._domPos(canvasDomElement, evt);
            // Start the rubber rectangle
            this._setRubberRectAnchor( pos );
            this._showRubberRect();
        }
    }

    _erasePointerMoveM( evt ) {
        if (this._allowedPointer(evt) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            let pos = this._domPos(canvasDomElement, evt);
            this._drawRubberRect( pos );
        }
    }

    _erasePointerUpM( evt ) {
        if (this._allowedPointer(evt) && this.pointerDown) {
            const canvasDomElement = this._currentCanvasDomElement();
            this.pointerDown = false;
            if (evt.pointerType == 'mouse') {
                canvasDomElement.style.cursor = 'default';
            } else {
                canvasDomElement.style.cursor = 'none';
            }
            this._hideRubberRect();
            const pos = this._domPos(canvasDomElement, evt);
            const rubberRect = {
                top: this._rubberRectAnchor[ 1 ],
                left: this._rubberRectAnchor[ 0 ],
                bottom: pos[ 1 ],
                right: pos[ 0 ]
            };
            this.isPenEngine.erase( canvasDomElement, rubberRect );
        }
    }

    /**
     * Checks if the dom element src is inside CKEditor (inside means editable area AND editor toolbar)
     * 
     * @param {dom element} src 
     */
    _srcInEditor( src ) {
        while ( src ) {
            if (src.classList.contains( 'ck-editor__main' ) || src.classList.contains( 'ck-editor__top' ) ) {
                return true;
            }
            src = src.parentElement;
        }
        return false;
    }

    _pointermoveListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            if ( this._allowedPointer(domEventData) && this._currentCanvasModelElement ) {
                this._pointerMoveH(event, domEventData);
            }
        }  
    }    

    _pointerupListener(event, domEventData) {
        const srcElement = domEventData.srcElement;
        if (srcElement.hasAttribute( 'data-ispcl-content' )) {
            // Pointer up in a canvas
        } else {
            // Pointer up outside of any canvas
        }
        this._pointerUpH(event, domEventData);
    }

    _isInRubbeRect( pos, rubberEndPos ) {
        if ( pos ) {
            return pos.x >= this._rubberRectAnchor.x && pos.x <= rubberEndPos.x && pos.y >= this._rubberRectAnchor.y && pos.y <= rubberEndPos.y;
        }
        return false;
    }

    /** 
     * @returns the isPencil model element, which is selected, or null
     */
    selectedWidgetModelElement() {
        const model = this.editor.model;  
        const selection = model.document.selection;
        const selectedModelElement = selection.getSelectedElement();
        if ( selectedModelElement && selectedModelElement.name == 'isPencil' ) {
            return selectedModelElement;
        }
        return null;
    }

    /**
     * 
     * @returns the selected canvas model element or null
     */
    selectedCanvasModelElement() {
        const selectedWidgetModelElement = this.selectedWidgetModelElement();
        return selectedWidgetModelElement?.getChild(0);
    }

    /**
     * Is called when we have been working on a specific canvas and terminate drawing.
     * Stores drawing data in the data- part of the canvas. .
     * 
     * @param {model element} canvasModelElement 
     */
    closeCanvas( canvasModelElement ) {
        if ( canvasModelElement ) { 
            const encoded = this.isPenEngine.getEncodedContent();
            // Reflect DOM changes to model changes
            this.editor.model.change( writer => {
                writer.setAttribute( 'content', encoded, canvasModelElement );
            } );
        }
    }

    /**
     * Returns undefined or the value of the attribute name of src
     * 
     * @param {HTML DOM element} src 
     * @param {string} name 
     * @returns 
     */
    _getDataValue(src, name) {
        const dataValue = src?.attributes.getNamedItem( name);
        return dataValue?.nodeValue;
    }

    /**
     * Checks that an event was generated either by a mouse or a pointer. This is to exclude touch events
     * 
     * @param {*} event 
     * @returns 
     */
    _allowedPointer(event) {
        return event.pointerType == 'mouse' || event.pointerType == 'pen';
        // return true;
    }
    
    /**
     * Returns the position of the event in dom element coordinates as an array with x at position 0 and y at position 1
     * 
     * @param {object} event 
     */
    _domPos(domElement, event) {
        let rect = domElement.getBoundingClientRect();
        // console.log( 'rect.width', rect.width );
        let x = event.pageX - rect.left - window.scrollX;
        // console.log( 'x', x );
        let y = event.pageY - rect.top - window.scrollY;
        // We use object literal shorthand
        return [ x, y ];
    }

    _showRubberLine() {        
        const rubberLineDomElement = this._currentRubberDomElement();
        rubberLineDomElement.style.display = 'block';
    }

    _showRubberRect() {        
        const rubberLineDomElement = this._currentRubberDomElement();
        rubberLineDomElement.style.display = 'block';
    }

    _hideRubberLine() {
        const rubberLineDomElement = this._currentRubberDomElement();
        rubberLineDomElement.style.display = 'none';
    }

    _hideRubberRect() {
        const rubberLineDomElement = this._currentRubberDomElement();
        rubberLineDomElement.style.display = 'none';
    }

    _setRubberLineAnchor( startPos ) {             
        const rubberLineDomElement = this._currentRubberDomElement();
        rubberLineDomElement.style.left = startPos[ 0 ] + 'px';
        rubberLineDomElement.style.top = startPos[ 1 ] + 'px';
        rubberLineDomElement.style.height = '0px';
        rubberLineDomElement.style.width = '0px';
        this._rubberLineAnchor = startPos;
    }

    _setRubberRectAnchor( startPos ) {    
        // Initial values
        this.rWidth = 10;
        this.rHeight = 10;   
        let left = startPos[ 0 ] - this.rWidth;
        if ( left < 0) {
            left = 0;
            this.rWidth = left;
        }
        let top = startPos[ 1 ] - this.rHeight;  
        if ( top < 0 ) {
            top = 0;
            this.rHeight = top;
        } 
        const rubberRectDomElement = this._currentRubberDomElement();
        rubberRectDomElement.style.left = left + 'px';
        rubberRectDomElement.style.top = top + 'px';
        rubberRectDomElement.style.height = startPos.x - left + 'px';
        rubberRectDomElement.style.width = startPos.y - top + 'px';
        rubberRectDomElement.style.transform = 'rotate(0rad)';
        this._rubberRectAnchor = startPos;
    }

    _drawRubberLine( endPos ) {          
        const rubberLineDomElement = this._currentRubberDomElement();
        let dx = endPos[ 0 ] - this._rubberLineAnchor[ 0 ];
        let dy = endPos[ 1 ] - this._rubberLineAnchor[ 1 ];
        let length = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);
        rubberLineDomElement.style.width = length + 'px';
        rubberLineDomElement.style['transform-origin'] = 'top left';
        rubberLineDomElement.style.transform = 'rotate(' + angle + 'rad)';
    }

    _drawRubberRect( endPos ) {          
        const rubberRectDomElement = this._currentRubberDomElement();
        let dx = endPos[ 0 ] - this._rubberRectAnchor[ 0 ] + this.rWidth;
        let dy = endPos[ 1 ] - this._rubberRectAnchor[ 1 ] + this.rHeight;
        rubberRectDomElement.style.width = dx + 'px';
        rubberRectDomElement.style.height = dy + 'px';
    }
}

/**
 * this.stroke is a string, while the line width is a number, which can be adjusted in this functio
 * 
 * @param {string} stroke 
 * @returns a number for this._ctx.lineWidth
 */
function _lineWidthFromStroke( stroke ) {
    switch (stroke) {
        case 'thin':
            return 2;
        case 'medium':
            return 5;
        case 'thick':
            return 10;
        case 'xthick':
            return 15;
        default:
            return 1;
    }
}