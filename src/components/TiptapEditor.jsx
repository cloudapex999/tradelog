import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { Plugin } from 'prosemirror-state';

const uploadImage = async (file) => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return null;

    const fileName = `${session.data.session.user.id}/${Date.now()}`;
    const { data, error } = await supabase.storage.from('journal-images').upload(fileName, file);
    if (error) {
        toast.error('Error uploading image: ' + error.message);
        return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('journal-images').getPublicUrl(fileName);
    return publicUrl;
};

const CustomImage = Image.extend({
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    handlePaste: (view, event) => {
                        const items = event.clipboardData.items;
                        for (const item of items) {
                            if (item.type.indexOf('image') !== -1) {
                                const file = item.getAsFile();
                                uploadImage(file).then(url => {
                                    if (url) {
                                        const { state } = view;
                                        const { tr } = state;
                                        const node = this.type.create({ src: url });
                                        const transaction = tr.replaceSelectionWith(node);
                                        view.dispatch(transaction);
                                    }
                                });
                                return true; // We handled this
                            }
                        }
                        return false; // Let other plugins handle it
                    },
                    handleDrop: (view, event) => {
                        const files = event.dataTransfer.files;
                        if (files.length > 0) {
                            for (const file of files) {
                                if (file.type.indexOf('image') !== -1) {
                                    uploadImage(file).then(url => {
                                        if (url) {
                                            const { state } = view;
                                            const { tr } = state;
                                            const node = this.type.create({ src: url });
                                            const transaction = tr.replaceSelectionWith(node);
                                            view.dispatch(transaction);
                                        }
                                    });
                                }
                            }
                            return true; // We handled this
                        }
                        return false; // Let other plugins handle it
                    },
                },
            }),
        ];
    },
});

const TiptapEditor = ({ content, onChange }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            CustomImage,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none p-4 focus:outline-none',
            },
        },
        autofocus: true,
        immediatelyRender: false,
    });

    return (
        <div className="border border-gray-600 rounded-lg">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

const EditorToolbar = ({ editor }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="border-b border-gray-600 p-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded ${editor.isActive('bold') ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Bold</button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded ${editor.isActive('italic') ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Italic</button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-2 py-1 rounded ${editor.isActive('strike') ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Strike</button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>H1</button>
            <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>H2</button>
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded ${editor.isActive('bulletList') ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>List</button>
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 rounded ${editor.isActive('blockquote') ? 'bg-gray-600' : 'hover:bg-gray-700'}`}>Quote</button>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 rounded hover:bg-gray-700">HR</button>
        </div>
    );
};

export default TiptapEditor;
