const express = require('express');
const serverless = require('serverless-http');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
app.use(express.json());

// Your MetaApi token - set this in Netlify dashboard later
const token = process.env.METAAPI_TOKEN;
const api = new MetaApi(token);

// Store active connection
let activeConnection = null;

// API Routes
app.get('/accounts', async (req, res) => {
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    res.json({ success: true, accounts });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/connect/:accountId', async (req, res) => {
  try {
    const account = await api.metatraderAccountApi.getAccount(req.params.accountId);
    
    if (account.state !== 'DEPLOYED') {
      await account.deploy();
    }
    
    const connection = await account.connect();
    await connection.waitSynchronized();
    activeConnection = connection;
    
    const accountInfo = await connection.getAccountInformation();
    
    res.json({ success: true, accountInfo });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/price/:symbol', async (req, res) => {
  try {
    if (!activeConnection) {
      return res.json({ success: false, error: 'Not connected' });
    }
    
    await activeConnection.subscribeToMarketData(req.params.symbol);
    const price = await activeConnection.getSymbolPrice(req.params.symbol);
    
    res.json({ success: true, price });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/trade', async (req, res) => {
  try {
    if (!activeConnection) {
      return res.json({ success: false, error: 'Not connected' });
    }
    
    const { symbol, type, volume } = req.body;
    
    let result;
    if (type === 'buy') {
      result = await activeConnection.createMarketBuyOrder(symbol, volume);
    } else {
      result = await activeConnection.createMarketSellOrder(symbol, volume);
    }
    
    res.json({ success: true, result });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Export for Netlify
exports.handler = serverless(app);
