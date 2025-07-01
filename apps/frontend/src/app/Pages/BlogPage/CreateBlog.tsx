'use client';
import React, { useState, useRef } from 'react';
import Header from '@/app/Components/Header/Header'
import { Col, Container, Row, Form, Button } from 'react-bootstrap';
import { FaBold, FaItalic, FaUnderline, FaListUl, FaFacebookF, FaXTwitter, FaLinkedinIn, FaCamera, FaPaperclip, FaRegCommentDots,  } from 'react-icons/fa6';
import "./BlogPage.css";
import { FaCloudUploadAlt } from 'react-icons/fa';

const communityOptions = [
  { label: "Facebook", icon: <FaFacebookF />, value: "facebook" },
  { label: "X", icon: <FaXTwitter />, value: "x" },
  { label: "LinkedIn", icon: <FaLinkedinIn />, value: "linkedin" }
];

function CreateBlog() {
  const [isLoggedIn] = useState(true);
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [community, setCommunity] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const descRef = useRef<HTMLTextAreaElement>(null);

  // Handle image upload and preview
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

  // Handle formatting (bold, italic, underline, list)
  const handleFormat = (type: 'bold' | 'italic' | 'underline' | 'list') => {
    if (!descRef.current) return;
    const textarea = descRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let newText = description;
    if (type === 'bold') {
      newText = description.slice(0, start) + '**' + description.slice(start, end) + '**' + description.slice(end);
    } else if (type === 'italic') {
      newText = description.slice(0, start) + '*' + description.slice(start, end) + '*' + description.slice(end);
    } else if (type === 'underline') {
      newText = description.slice(0, start) + '<u>' + description.slice(start, end) + '</u>' + description.slice(end);
    } else if (type === 'list') {
      newText = description.slice(0, start) + '\n- ' + description.slice(start, end) + '\n' + description.slice(end);
    }
    setDescription(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(end + (type === 'list' ? 4 : type === 'underline' ? 7 : 2), end + (type === 'list' ? 4 : type === 'underline' ? 7 : 2));
    }, 0);
  };

  // Handle community share selection
  const toggleCommunity = (val: string) => {
    setCommunity(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit logic here
    alert(JSON.stringify({ title, keywords, description, community, image }, null, 2));
  };

  return (
    <>
      <Header isLoggedIn={isLoggedIn} />
      <section className='CreateBlogSec'>
        <Container>
          <Row >
            <Col md={8} >
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
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label className="blog-label">Keywords</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter keywords"
                        className="blog-input"
                        value={keywords}
                        onChange={e => setKeywords(e.target.value)}
                      />
                    </Form.Group>
                    <div className="blog-upload-area mb-3">
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        id="blog-image-upload"
                        style={{ display: 'none' }}
                        onChange={handleImageChange}
                      />
                      <label htmlFor="blog-image-upload" className="blog-upload-label">
                        <FaCloudUploadAlt size={40} color="#1976D2" />
                        <div>Upload Image/Banner</div>
                        <div className="blog-upload-desc">Only PNG, JPEG formats with max size 20 MB</div>
                      </label>
                      {imageUrl && (
                        <div className="blog-uploaded-file">
                          <img src={imageUrl} alt="preview" style={{ maxWidth: 120, maxHeight: 80, borderRadius: 8, marginTop: 8 }} />
                        </div>
                      )}
                    </div>
                    <Form.Group className="mb-3">
                      <Form.Control
                        as="textarea"
                        rows={5}
                        placeholder="Description"
                        className="blog-textarea"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        ref={descRef}
                      />
                      <div className="blog-toolbar">
                        <span onClick={() => handleFormat('bold')}><FaBold /></span>
                        <span onClick={() => handleFormat('underline')}><FaUnderline /></span>
                        <span onClick={() => handleFormat('italic')}><FaItalic /></span>
                        <span onClick={() => handleFormat('list')}><FaListUl /></span>
                      </div>
                      <div className="blog-toolbar-right">
                        <span><FaRegCommentDots /></span>
                        <span><FaCamera /></span>
                        <span><FaPaperclip /></span>
                      </div>
                    </Form.Group>
                    <div className="blog-community-share mb-3">
                      <div style={{ flex: 1 }}>
                        <Form.Label className="blog-label">Select community share!</Form.Label>
                        <div style={{ display: 'flex', gap: 12 }}>
                          {communityOptions.map(opt => (
                            <Button
                              key={opt.value}
                              variant={community.includes(opt.value) ? "primary" : "outline-secondary"}
                              className="blog-social-btn"
                              onClick={() => toggleCommunity(opt.value)}
                              type="button"
                            >
                              {opt.icon}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button type="submit" className="mt-2" style={{ borderRadius: 20, padding: "8px 32px" }}>
                      Publish Blog
                    </Button>
                  </Form>
                </div>


              </div>
            </Col>
          </Row>
        </Container>
      </section>
    </>
  )
}

export default CreateBlog;