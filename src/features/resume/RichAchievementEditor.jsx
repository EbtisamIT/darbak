import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FiBold, FiItalic, FiList } from "react-icons/fi";
import { stripHtml } from "./resumeDefaults";

const RichAchievementEditor = ({ value = {}, onChange, placeholder = "اكتب نقطة إنجاز مختصرة..." }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: true,
      }),
    ],
    content: value.html || value.text || "<p></p>",
    editorProps: {
      attributes: {
        class: "resume-rich-editor-content",
        "aria-label": placeholder,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      onChange?.({
        ...value,
        html,
        text: currentEditor.getText().trim() || stripHtml(html),
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextContent = value.html || value.text || "<p></p>";
    if (nextContent !== editor.getHTML()) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, value.html, value.text]);

  if (!editor) {
    return <div className="resume-rich-editor is-loading">جاري تجهيز المحرر...</div>;
  }

  return (
    <div className="resume-rich-editor">
      <div className="resume-rich-toolbar" aria-label="تنسيق نقطة الإنجاز">
        <button
          type="button"
          className={editor.isActive("bold") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="غامق"
        >
          <FiBold aria-hidden="true" />
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="مائل"
        >
          <FiItalic aria-hidden="true" />
        </button>
        <button
          type="button"
          className={editor.isActive("bulletList") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="قائمة نقطية"
        >
          <FiList aria-hidden="true" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichAchievementEditor;
