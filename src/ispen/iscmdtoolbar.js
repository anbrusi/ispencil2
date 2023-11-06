// iscmdtoolbar.js

import { ToolbarView } from '@ckeditor/ckeditor5-ui';
import IsCmdButton from './iscmdbutton.js';

export default class IsCmdToolbar extends ToolbarView {

    /**
     * 
     * @param {*} locale 
     * @param {array} buttons array of button definition objects
     * @param {object} options this is a custom built object passed to the toolbar from iscmdpanel
     */
    constructor( locale, buttons, options ) {
        super( locale, buttons );

        // this.commandPanel = options.commandPanel;
        this.set('activeCustomid', options.defaultCustomid);

        const bind = this.bindTemplate;

        if ( buttons?.length > 0 ) {
            // console.log('buttons', buttons );
            for (let buttondef of buttons) {
                buttondef.toolbar = this;
                // buttondef is one of the definition objects in the buttons array built in iscmdpanel
                const button = new IsCmdButton( locale, buttondef );
                button.on( 'execute', this._buttonExecute.bind(this) );
                this.items.add( button );
            }
        }
    }

    _buttonExecute( evt ) {
        // console.log('IsCmdToolbar#buttonExecute event', evt );
        const customid = evt.source.customid;
        // console.log('IsCmdToolbar#buttonExecute customid', customid );
        this.set( 'activeCustomid', customid );
    }
}