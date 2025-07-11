"use client";
import React, { useState, useRef } from "react";
import Header from "@/app/Components/Header/Header";
import { Col, Container, Row, Form, Button, Spinner } from "react-bootstrap";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaListUl,
  FaFacebookF,
  FaXTwitter,
  FaLinkedinIn,
  FaCamera,
  FaPaperclip,
  FaRegCommentDots,
} from "react-icons/fa6";
import "./BlogPage.css";
import axios from "axios";

const communityOptions = [
  { label: "Facebook", icon: <FaFacebookF />, value: "facebook" },
  { label: "X", icon: <FaXTwitter />, value: "x" },
  { label: "LinkedIn", icon: <FaLinkedinIn />, value: "linkedin" },
];

const topicOptions = [
  "Medication",
  "Nutrition",
  "Fleas and Ticks",
  "Pet Anxiety",
  "Mental Health",
  "Allergies",
  "Socialization",
  "Skin Care",
  "Limping ",
  "Wellness",
  "Insurance",
];

function CreateBlog() {
  const [formData, setFormData] = useState({
    title: "",
    animalType: "",
    topic: "",
    description: "",
  });
  const [community, setCommunity] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [isLoggedIn] = useState(true);

  const descRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageUrl(null);
    }
  };

  const handleFormat = (type: "bold" | "italic" | "underline" | "list") => {
    if (!descRef.current) return;
    const textarea = descRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let newText = formData.description;

    const wrapText = (before: string, after: string = before) => {
      return (
        formData.description.slice(0, start) +
        before +
        formData.description.slice(start, end) +
        after +
        formData.description.slice(end)
      );
    };

    switch (type) {
      case "bold":
        newText = wrapText("**");
        break;
      case "italic":
        newText = wrapText("*");
        break;
      case "underline":
        newText = wrapText("<u>", "</u>");
        break;
      case "list":
        newText =
          formData.description.slice(0, start) +
          "\n- " +
          formData.description.slice(start, end) +
          "\n" +
          formData.description.slice(end);
        break;
    }

    setFormData((prev) => ({ ...prev, description: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(end + 2, end + 2);
    }, 0);
  };

  const toggleCommunity = (val: string) => {
    setCommunity((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]
    );
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.title.trim()) newErrors.title = "Blog title is required";
    else if (formData.title.trim().length < 5)
      newErrors.title = "Title must be at least 5 characters";

    if (!formData.topic) newErrors.topic = "Topic selection is required";

    if (!formData.description.trim()) newErrors.description = "Description is required";
    else if (formData.description.trim().length < 20)
      newErrors.description = "Description must be at least 20 characters";

    if (!image) newErrors.image = "Image is required";
    else {
      const allowed = ["image/jpeg", "image/png"];
      if (!allowed.includes(image.type))
        newErrors.image = "Only JPEG or PNG images allowed";
      if (image.size > 20 * 1024 * 1024) newErrors.image = "Max size is 20MB";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const form = new FormData();
    form.append("blogTitle", formData.title);
    form.append("animalType", formData.animalType);
    form.append("topic", formData.topic);
    form.append("description", formData.description);
    form.append("image", image!);

    try {
      setLoading(true);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}fhir/v1/addBlog`,
        form,
        {
          // withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (!res.data) throw new Error(res.data.message || "Upload failed");

      alert("✅ Blog created successfully!");
      setFormData({ title: "", animalType: "", topic: "", description: "" });
      setImage(null);
      setImageUrl(null);
      setCommunity([]);
      setErrors({});
    } catch (error: any) {
      alert("❌ " + error.message);
    } finally {
      setLoading(false);
    }
  };
console.log(formData,"formDataformDataformDataformData")
  return (
    <>
      <Header />
      <section className="CreateBlogSec">
        <Container>
          <Row>
            <Col md={8}>
              <div className="CreateBlogData">
                <div className="CreateHead">
                  <h3>Create Blog</h3>
                </div>
                <div className="BlogEditorDiv">
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-2">
                      <Form.Label className="blog-label">Blog Title</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter blog title"
                        className="blog-input"
                        name="title"
                        value={formData.title}
                        onChange={(e) =>handleInputChange(e)}
                      />
                      {errors.title && (
                        <div className="text-danger">{errors.title}</div>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-2">
                      <Form.Label className="blog-label">Animal Type</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter Animal Type"
                        className="blog-input"
                        name="animalType"
                        value={formData.animalType}
                        onChange={(e) =>handleInputChange(e)}
                      />
                    </Form.Group>

                    <Form.Group className="mb-2">
                      <Form.Label className="blog-label">Select Topic</Form.Label>
                      <Form.Select
                        className="blog-input"
                        value={formData.topic}
                        name="topic"
                        onChange={(e) =>handleInputChange(e)}
                      >
                        <option value="">Select Topic</option>
                        {topicOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                      {errors.topic && (
                        <div className="text-danger">{errors.topic}</div>
                      )}
                    </Form.Group>

                    <div className="blog-upload-area mb-3">
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        id="blog-image-upload"
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                        // name=""
                      />
                      <label
                        htmlFor="blog-image-upload"
                        className="blog-upload-label"
                      >
                        <div>Upload Image/Banner</div>
                        <div className="blog-upload-desc">
                          Only PNG, JPEG formats. Max 20 MB
                        </div>
                      </label>
                      {errors.image && (
                        <div className="text-danger">{errors.image}</div>
                      )}
                      {imageUrl && (
                        <div className="blog-uploaded-file">
                          <img
                            src={imageUrl}
                            alt="preview"
                            style={{
                              maxWidth: 120,
                              maxHeight: 80,
                              borderRadius: 8,
                              marginTop: 8,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <Form.Group className="mb-3">
                      <Form.Control
                        as="textarea"
                        rows={5}
                        placeholder="Description"
                        className="blog-textarea"
                        name="description"
                        value={formData.description}
                        onChange={(e) =>handleInputChange(e)}
                        ref={descRef}
                      />
                      {errors.description && (
                        <div className="text-danger">{errors.description}</div>
                      )}
                      <div className="blog-toolbar">
                        <span onClick={() => handleFormat("bold")}>
                          <FaBold />
                        </span>
                        <span onClick={() => handleFormat("underline")}>
                          <FaUnderline />
                        </span>
                        <span onClick={() => handleFormat("italic")}>
                          <FaItalic />
                        </span>
                        <span onClick={() => handleFormat("list")}>
                          <FaListUl />
                        </span>
                      </div>
                      <div className="blog-toolbar-right">
                        <span>
                          <FaRegCommentDots />
                        </span>
                        <span>
                          <FaCamera />
                        </span>
                        <span>
                          <FaPaperclip />
                        </span>
                      </div>
                    </Form.Group>

                    <div className="blog-community-share mb-3">
                      <Form.Label className="blog-label">
                        Select community share!
                      </Form.Label>
                      <div style={{ display: "flex", gap: 12 }}>
                        {communityOptions.map((opt) => (
                          <Button
                            key={opt.value}
                            variant={
                              community.includes(opt.value)
                                ? "primary"
                                : "outline-secondary"
                            }
                            className="blog-social-btn"
                            onClick={() => toggleCommunity(opt.value)}
                            type="button"
                          >
                            {opt.icon}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="mt-2"
                      style={{ borderRadius: 20, padding: "8px 32px" }}
                      disabled={loading}
                    >
                      {loading ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        "Publish Blog"
                      )}
                    </Button>
                  </Form>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>
    </>
  );
}

export default CreateBlog;
