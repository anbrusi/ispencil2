// ispencil/ispencilposecommand.js

import { Command } from '@ckeditor/ckeditor5-core';
import IsCanvas from './ispen/iscanvas';
import IsResizing from './resize/isresizing';

export default class IsPencilPosCommand extends Command {

    isCanvas = this.editor.plugins.get( IsCanvas );

    isResizing = this.editor.plugins.get( IsResizing );

	static get pluginName() {
		return 'IsPencilPosCommand';
	}

    /**
     * Checks if an ispencil node is selected. If yes, the position is set to position.
     * 
     * @param {string} position
     */
    execute( position ) {
        // console.log( 'ispencilposcommend#execute position', position );
        // If the position changes, the model is downcated again, so it must be kept up to date
        const selectedModelElement = this.isCanvas.selectedWidgetModelElement();
        if ( selectedModelElement ) {
            // Change of position must be wrapped by hiding and showing the resizer, because position change causes
            // a downcast, which remakes resizer handles, without changing the selected widget.
            // The resizing handles logic is attached by showResizer, which normally gets called by a selection change,
            // but a position change does not trigger a selection change.
            this.isResizing.hideResizer( selectedModelElement );
            this.editor.model.change( writer => {
                writer.setAttribute( 'position', position, selectedModelElement );
            } );
            this.isResizing.showResizer( selectedModelElement );
        }
    }

    refresh() {     
        // console.log( 'IsPencilPosCommand#refresh' );
        const selection = this.editor.model.document.selection;
        const selectedModelElement = selection.getSelectedElement();
        this.isEnabled = !!selectedModelElement;
    }
}