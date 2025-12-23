import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { appsData } from '../data/apps';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Xin chào! Tôi là trợ lý ảo. Bạn đang tìm kiếm ứng dụng nào? Bạn có thể chọn danh mục bên dưới hoặc gõ tên ứng dụng.' }
  ]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMsg = { type: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);

    // Process bot response
    processResponse(inputText);
    setInputText('');
  };

  const processResponse = (input) => {
    const lowerInput = input.toLowerCase();
    let foundApps = [];

    // Search logic
    appsData.forEach(category => {
      // Check if category name matches
      if (category.category.toLowerCase().includes(lowerInput)) {
        foundApps.push(...category.items);
      } else {
        // Otherwise check individual items
        category.items.forEach(item => {
          const hasKeywordMatch = item.keywords?.some(k => k.toLowerCase().includes(lowerInput));
          if (
            hasKeywordMatch ||
            item.title.toLowerCase().includes(lowerInput) ||
            item.subtitle.toLowerCase().includes(lowerInput) ||
            item.department.toLowerCase().includes(lowerInput)
          ) {
            // Avoid duplicates if we already added via category
            if (!foundApps.find(a => a.id === item.id)) {
              foundApps.push(item);
            }
          }
        });
      }
    });

    setTimeout(() => {
      if (foundApps.length > 0) {
        const appLinks = foundApps.map(app => `[${app.title}](${app.url})`).join(', ');
        // For simplicity in this demo, passing app objects to render specially or just text
        // Let's modify the message structure to handle clickable actions or simple text
        setMessages(prev => [...prev, {
          type: 'bot',
          text: `Tôi tìm thấy ${foundApps.length} kết quả phù hợp:`,
          actions: foundApps
        }]);
      } else {
        setMessages(prev => [...prev, { type: 'bot', text: 'Xin lỗi, tôi không tìm thấy ứng dụng nào khớp với từ khóa của bạn. Thử tìm theo tên phòng ban xem sao?' }]);
      }
    }, 500);
  };

  const handleQuickOption = (categoryName) => {
    const userMsg = { type: 'user', text: `Tìm ứng dụng thuộc ${categoryName}` };
    setMessages(prev => [...prev, userMsg]);

    const category = appsData.find(c => c.category === categoryName);
    setTimeout(() => {
      if (category && category.items.length > 0) {
        setMessages(prev => [...prev, {
          type: 'bot',
          text: `Dưới đây là các ứng dụng trong mục ${categoryName}:`,
          actions: category.items
        }]);
      } else {
        setMessages(prev => [...prev, { type: 'bot', text: 'Chưa có ứng dụng nào trong mục này.' }]);
      }
    }, 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="chatbot-wrapper">
      {/* Toggle Button */}
      <button
        className={`chatbot-toggle ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      <div className={`chatbot-window ${isOpen ? 'open' : ''}`}>
        <div className="chatbot-header">
          <div className="header-title">
            <Bot size={20} />
            <span>Trợ lý hỗ trợ</span>
          </div>
          <button className="close-btn" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="chatbot-body">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.type}`}>
              {msg.type === 'bot' && <div className="avatar"><Bot size={16} /></div>}
              <div className="message-content">
                <p>{msg.text}</p>
                {msg.actions && (
                  <div className="message-actions">
                    {msg.actions.map(app => (
                      <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className="action-chip">
                        {app.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Quick Options (Only show if it's the start or user is asking for help) */}
          {messages.length === 1 && (
            <div className="quick-options">
              {appsData.map((cat, idx) => (
                <button key={idx} onClick={() => handleQuickOption(cat.category)}>
                  {cat.category}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-footer">
          <input
            type="text"
            placeholder="Gõ tên ứng dụng..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleSend}>
            <Send size={18} />
          </button>
        </div>
      </div>

      <style>{`
        .chatbot-wrapper {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 1000;
          font-family: 'Inter', sans-serif;
        }
        .chatbot-toggle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, opacity 0.2s;
        }
        .chatbot-toggle:hover {
          transform: scale(1.05);
        }
        .chatbot-toggle.hidden {
          opacity: 0;
          pointer-events: none;
        }

        .chatbot-window {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 380px;
          height: 700px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .chatbot-window.open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .chatbot-header {
          padding: 1rem;
          background: linear-gradient(to right, #2563eb, #1d4ed8);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }
        .close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          opacity: 0.8;
        }
        .close-btn:hover { opacity: 1; }

        .chatbot-body {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: #f8fafc;
        }

        .message {
          display: flex;
          gap: 0.5rem;
          max-width: 85%;
          animation: fadeIn 0.3s ease;
        }
        .message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .message.bot .avatar {
          width: 28px;
          height: 28px;
          background: #e0e7ff;
          color: #2563eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .message-content {
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.9rem;
          line-height: 1.5;
          position: relative;
        }
        .message.user .message-content {
          background: #2563eb;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .message.bot .message-content {
          background: white;
          color: #1e293b;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .message-actions {
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .action-chip {
          display: block;
          padding: 0.5rem 0.75rem;
          background: #f1f5f9;
          color: #334155;
          text-decoration: none;
          border-radius: 6px;
          font-size: 0.85rem;
          transition: all 0.2s;
          border: 1px solid #e2e8f0;
        }
        .action-chip:hover {
          background: #e0e7ff;
          color: #2563eb;
          border-color: #c7d2fe;
        }

        .quick-options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: auto;
        }
        .quick-options button {
          padding: 0.4rem 0.8rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          color: #2563eb;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .quick-options button:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .chatbot-footer {
          padding: 1rem;
          background: white;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 0.5rem;
        }
        .chatbot-footer input {
          flex: 1;
          padding: 0.6rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          outline: none;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .chatbot-footer input:focus {
          border-color: #2563eb;
        }
        .chatbot-footer button {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
        }
        .chatbot-footer button:hover {
          background: #1d4ed8;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ChatBot;
