// ckeditor.js 

import { ClassicEditor as ClassicEditorBase } from '@ckeditor/ckeditor5-editor-classic';
import { Bold, Italic } from '@ckeditor/ckeditor5-basic-styles';
import { Essentials } from '@ckeditor/ckeditor5-essentials';
import { Heading } from '@ckeditor/ckeditor5-heading';
import { List } from '@ckeditor/ckeditor5-list';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph';
import IsPencil from '../src/ispencil';


export default class ClassicEditor extends ClassicEditorBase {}

ClassicEditor.builtinPlugins = [
    Essentials,
    Bold,
    Italic,
    Heading,
    List,
    Paragraph,
    IsPencil
];

ClassicEditor.defaultConfig = {
    toolbar: {
        items: [
            'heading',
            '|',
            'bold',
            'italic',
            '|',
            'bulletedList',
            'numberedList',
            '|',
            'isPencil'
        ]
    },
	// This is the default. It is overridden in PHP by the configuration in ClassicEditor.create
	isPencil: {
		width: 400,
		height: 400,
		position: 'center',
		hasBorder: false,
		toolbar: [ 'isPencilLeft', 'isPencilCenter', 'isPencilRight' ]
	},
    language: 'en'
};
