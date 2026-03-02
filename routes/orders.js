const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');
const tokopay = require('../services/tokopay');

function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `MXS-${timestamp}-${random}`;
}

// POST /api/orders — public, create order
router.post('/', async (req, res) => {
    try {
        const { product_id, payment_method, buyer_email, buyer_name } = req.body;
        if (!product_id || !payment_method) {
            return res.status(400).json({ error: 'Product ID and payment method are required.' });
        }

        const db = getDb();
        const productResult = await db.execute('SELECT * FROM products WHERE id = ? AND is_active = 1', [product_id]);
        const product = productResult.rows[0];

        if (!product) return res.status(404).json({ error: 'Product not found.' });
        if (product.stock <= 0) return res.status(400).json({ error: 'Product is out of stock.' });

        const orderId = generateOrderId();

        const payment = await tokopay.createTransaction(orderId, product.price * 15000, payment_method, {
            productId: String(product.id),
            productName: product.name,
        });

        await db.execute(
            'INSERT INTO orders (order_id, product_id, product_name, amount, payment_method, payment_url, qr_url, status, buyer_email, buyer_name, tokopay_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [orderId, product.id, product.name, product.price, payment_method, payment.paymentUrl || null, payment.qrUrl || null, 'pending', buyer_email || null, buyer_name || null, payment.reference || null]
        );

        const orderResult = await db.execute('SELECT * FROM orders WHERE order_id = ?', [orderId]);

        res.status(201).json({
            success: true,
            order: orderResult.rows[0],
            payment: { url: payment.paymentUrl, qr: payment.qrUrl, reference: payment.reference }
        });
    } catch (err) {
        console.error('Order create error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/orders/:orderId
router.get('/:orderId', async (req, res) => {
    try {
        const db = getDb();
        const result = await db.execute('SELECT * FROM orders WHERE order_id = ?', [req.params.orderId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/orders/webhook/tokopay
router.post('/webhook/tokopay', async (req, res) => {
    try {
        const data = req.body;
        console.log('🔔 Tokopay webhook received:', data);

        const isValid = tokopay.verifyWebhookSignature(data);
        if (!isValid) return res.status(403).json({ error: 'Invalid signature.' });

        const db = getDb();
        const orderResult = await db.execute('SELECT * FROM orders WHERE order_id = ?', [data.reff_id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });

        const order = orderResult.rows[0];
        const newStatus = data.status === 'Paid' || data.status === 'paid' ? 'paid' : data.status.toLowerCase();

        await db.execute(
            'UPDATE orders SET status = ?, tokopay_ref = COALESCE(?, tokopay_ref), updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
            [newStatus, data.trx_id || null, data.reff_id]
        );

        if (newStatus === 'paid') {
            await db.execute('UPDATE products SET stock = MAX(0, stock - 1) WHERE id = ?', [order.product_id]);
        }

        res.json({ success: true, status: newStatus });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/orders/admin/list — protected
router.get('/admin/list', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const { status, limit } = req.query;

        let query = 'SELECT * FROM orders';
        const params = [];

        if (status) { query += ' WHERE status = ?'; params.push(status); }
        query += ' ORDER BY created_at DESC';
        if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

        const result = await db.execute(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
