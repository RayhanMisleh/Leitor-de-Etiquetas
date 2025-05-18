const express = require('express');
const bodyParser = require('body-parser');
const venom = require('venom-bot');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3404;
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

app.use(bodyParser.json());

let clientInstance = null;

venom
  .create({
    session: 'session-whatsapp',
    multidevice: false,
    useChrome: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  .then((client) => {
    clientInstance = client;
    console.log('✅ Bot Venom iniciado com sucesso.');

    client.onMessage(async (message) => {
      if (message.type === 'image') {
        try {
          const media = await client.decryptFile(message);
          const fileName = `${message.sender.id}_${Date.now()}.jpg`;
          const filePath = path.join(UPLOAD_FOLDER, fileName);
          fs.writeFileSync(filePath, media);

          const base64Image = media.toString('base64');
          await axios.post(WEBHOOK_URL, {
            image_base64: base64Image,
            from: message.sender.id,
            filename: fileName
          });

          console.log('✅ Imagem enviada ao n8n com sucesso!');
        } catch (err) {
          console.error('❌ Erro ao processar imagem:', err.message);
        }
      }
    });

    // Somente após o bot estar pronto, iniciamos o servidor HTTP
    app.listen(port, () => {
      console.log(`🚀 Servidor HTTP escutando em http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao iniciar o Venom:', err);
  });

// Rota para receber mensagens externas (ex: n8n)
app.post('/send-text', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Campos "number" e "message" são obrigatórios.' });
  }

  if (!clientInstance) {
    return res.status(503).json({ error: 'Bot ainda não está pronto.' });
  }

  try {
    await clientInstance.sendText(number, message);
    console.log(`✅ Mensagem enviada para ${number}: ${message}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
});
