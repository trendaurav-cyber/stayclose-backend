const express = require('express');
const admin = require('firebase-admin');
const app = express();
app.use(express.json());

// ✅ Initialize Firebase Admin using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ✅ Register user's FCM token with their phone number
app.post('/register', async (req, res) => {
  const { phone, token } = req.body;
  if (!phone || !token) {
    return res.status(400).json({ error: 'phone and token required' });
  }
  try {
    await db.collection('users').doc(phone).set({ token, updatedAt: new Date() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Send SOS notification to all guardian phones
app.post('/send-sos', async (req, res) => {
  const { guardianPhones, senderName, location } = req.body;
  if (!guardianPhones || !location) {
    return res.status(400).json({ error: 'guardianPhones and location required' });
  }
  try {
    const results = [];
    for (const phone of guardianPhones) {
      const doc = await db.collection('users').doc(phone).get();
      if (!doc.exists) continue;
      const { token } = doc.data();
      await admin.messaging().send({
        token,
        notification: {
          title: '🚨 SOS Emergency Alert!',
          body: `${senderName || 'Someone'} needs help! Tap to see location.`,
        },
        data: {
          location,
          type: 'sos',
        },
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'sos_channel' },
        },
      });
      results.push(phone);
    }
    res.json({ success: true, notified: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => res.json({ status: 'StayClose backend running ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
