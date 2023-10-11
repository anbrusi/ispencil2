// ispencil/ispencil.js

import { Plugin } from '@ckeditor/ckeditor5-core';
import IsPencilEditing from './ispencilediting';
import IsPencilToolbar from './ispenciltoolbar';
import IsPencilUI from './ispencilui';
import IsCanvas from './ispen/iscanvas';
import '../theme/style.css';

export default class IsPencil extends Plugin {

	static get pluginName() {
		return 'IsPencil';
	}

    static get requires() {
        return [ IsPencilEditing, IsPencilToolbar, IsPencilUI, IsCanvas ];
        // return [ ];
    }

    init() {
        console.log( 'IsPencil#init' );
    }
}