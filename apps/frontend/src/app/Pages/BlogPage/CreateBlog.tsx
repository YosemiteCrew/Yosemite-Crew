"use client";
import React, { useState, useRef } from "react";
import { Col, Container, Row, Form, Button, Spinner } from "react-bootstrap";
import { FaFacebookF, FaXTwitter, FaLinkedinIn } from "react-icons/fa6";
import "./BlogPage.css";
import axios from "axios";
import EditorJSRenderer from "@/app/Components/EditorJs/EditorJs";
import edjsHTML from "editorjs-html";
import { useAuthStore } from "@/app/stores/authStore";

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
  const [editorData, setEditorData] = useState<any>({ blocks: [] });
  const businessId = useAuthStore((state: any) => state.userId);
  const edjsParser: any = edjsHTML();

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
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
    if (!formData.animalType) newErrors.animalType = "Animal Type is required";

    if (!formData.description || formData.description.trim().length < 20)
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

    setLoading(true);

    try {
      // Send final blog payload
      const form = new FormData();
      form.append("businessId", businessId);
      form.append("blogTitle", formData.title);
      form.append("animalType", formData.animalType);
      form.append("topic", formData.topic);
      form.append("description", formData.description);
      form.append("image", image!);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}fhir/v1/addBlog`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      alert("Blog published successfully!");
    } catch (err) {
      console.error(err, "Error publishing blog");
      // alert("Failed to publish blog");
    } finally {
      setLoading(false);
    }
  };

  const handleEditorChange = (data: any) => {
    setEditorData(data);
    const htmlString = edjsParser.parse(data);
    setFormData((prev) => ({ ...prev, description: htmlString }));
  };
  console.log(image, "image");
  return (
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
                  {/* Blog Title */}
                  <Form.Group className="mb-2">
                    <Form.Label className="blog-label">Blog Title</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter blog title"
                      className="blog-input"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                    />
                    {errors.title && (
                      <div className="text-danger">{errors.title}</div>
                    )}
                  </Form.Group>

                  {/* Animal Type */}
                  <Form.Group className="mb-2">
                    <Form.Label className="blog-label">Animal Type</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter Animal Type"
                      className="blog-input"
                      name="animalType"
                      value={formData.animalType}
                      onChange={handleInputChange}
                    />
                    {errors.animalType && (
                      <div className="text-danger">{errors.animalType}</div>
                    )}
                  </Form.Group>
                  {/* Topic */}
                  <Form.Group className="mb-2">
                    <Form.Label className="blog-label">Select Topic</Form.Label>
                    <Form.Select
                      className="blog-input"
                      value={formData.topic}
                      name="topic"
                      onChange={handleInputChange}
                    >
                      <option value="">Select Topic</option>
                      {topicOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Form.Select>
                    {errors.topic && (
                      <div className="text-danger">{errors.topic}</div>
                    )}
                  </Form.Group>

                  {/* Banner Upload */}
                  <div className="blog-upload-area mb-3">
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      id="blog-image-upload"
                      style={{ display: "none" }}
                      onChange={handleImageChange}
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

                  {/* Description */}
                  <Form.Group className="mb-3">
                    <Form.Label className="blog-label">Description</Form.Label>
                    <div
                      style={{
                        border: "1px solid #ccc",
                        padding: 12,
                        borderRadius: 8,
                      }}
                    >
                      <EditorJSRenderer
                        data={editorData}
                        onChange={handleEditorChange}
                      />
                    </div>
                    {errors.description && (
                      <div className="text-danger mt-1">
                        {errors.description}
                      </div>
                    )}
                  </Form.Group>

                  {/* Community Share */}
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
  );
}

export default CreateBlog;
