// iscmdbutton.js

import { ButtonView } from '@ckeditor/ckeditor5-ui'

export default class IsCmdButton extends ButtonView {

    /**
     * 
     * @param {*} locale 
     * @param {object} options This is the button definition made in iscmdpanel, when creating the toolbar
     */
    constructor(locale, options) {

       /**
        * this.activeCustomid is bound to activeCustomid of the owning toolbar by its constructor when it instantiates its buttons
        */

        super(locale);

        this._toolbar = options.toolbar;

        const bind = this.bindTemplate;
        this.bind('isOn').to(this._toolbar, 'activeCustomid', () => {
            const on = this._toolbar.activeCustomid == options.customid;
            console.log( 'isOn', on );
            if ( on ) {
                this.set('bkcolor', 'lime' );
            } else {
                this.set('bkcolor', undefined );
            }
            console.log( `bkcolor on ${ this._toolbar.activeCustomid } `, this.bkcolor );
            return on;
        } );

        this.extendTemplate({
            attributes: {
                'data-ispcl-customid': options.customid,
                style: {
                    backgroundColor: bind.to('bkcolor')
                }
            }
        });
        this.set( {
            label: this.t( options.labeltext ),
            icon: options.icon,
            tooltip: options.tooltip,
            customid: options.customid
        } );
    }
}