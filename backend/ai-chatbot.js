
'use strict';

const AIChatbot = (() => {
  let sessions = {};
  let currentPatient = null;

  const setPatient = (patient) => { currentPatient = patient; };

  const sendMessage = async (message, sessionId, patientData) => {
    
    if (patientData) setPatient(patientData);
    
    if (!sessions[sessionId]) {
      sessions[sessionId] = { id: sessionId, messages: [] };
    }
    const session = sessions[sessionId];
    
   
    session.messages.push({ role: 'user', content: message, ts: new Date().toISOString() });

    try {
        
        const patientContext = currentPatient ? JSON.stringify(currentPatient) : "No specific medical records found.";

       
        const response = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: message,
                userHealthContext: patientContext
            })
        });

        const data = await response.json();

       
        if (data.success) {
            const reply = data.reply;
            session.messages.push({ role: 'assistant', content: reply, ts: new Date().toISOString() });
            return { reply, session_id: sessionId };
        } else {
            throw new Error(data.message || "Backend API failed to respond.");
        }

    } catch (error) {
        console.error("Chatbot Connection Error:", error);
        
       
        const fallbackReply = "⚠️ Sorry, I am unable to connect to the medical AI server right now. Please ensure your backend is running.";
        session.messages.push({ role: 'assistant', content: fallbackReply, ts: new Date().toISOString() });
        return { reply: fallbackReply, session_id: sessionId };
    }
  };

  const createSession = () => 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

  return { sendMessage, createSession, setPatient };
})();

window.AIChatbot = AIChatbot;