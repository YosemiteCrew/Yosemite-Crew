"use client";

import React, { useEffect, useRef } from "react";
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import ImageTool from "@editorjs/image";
import axios from "axios";

interface EditorProps {
  data: any;
  onChange: (data: any) => void;
}

const EditorJSRenderer: React.FC<EditorProps> = ({ data, onChange }) => {
  const ejInstance = useRef<EditorJS | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new EditorJS({
      holder: editorRef.current,
      data,
      tools: {
        header: { class: Header as any, inlineToolbar: true },
        list: { class: List as any, inlineToolbar: true },
        quote: { class: Quote as any, inlineToolbar: true },
        image: {
          class: ImageTool,
          config: {
            uploader: {
              async uploadByFile(file: File) {
                try {
                  const formData = new FormData();
                  formData.append("image", file);
                  const res:any = await axios.post(
                    `${process.env.NEXT_PUBLIC_BASE_URL}fhir/v1/uploadDescriptionImg`,
                    formData,
                    { headers: { "Content-Type": "multipart/form-data" } }
                  );
                  const uploadedUrl = res.data?.file?.url;
                  if (!uploadedUrl) throw new Error("No URL in response");
                  return {
                    success: 1,
                    file: { url: uploadedUrl },
                  };
                } catch (error) {
                  console.error("Image upload failed:", error);
                  return { success: 0 };
                }
              },
            },
          },
        },
      },
      onChange: async () => {
        const content = await editor.save();
        onChange(content);
      },
    });

    ejInstance.current = editor;

    return () => {
      if (
        ejInstance.current &&
        typeof ejInstance.current.destroy === "function"
      ) {
        ejInstance.current.destroy();
      }
      ejInstance.current = null;
    };
  }, []);

  return <div ref={editorRef} />;
};

export default EditorJSRenderer;
