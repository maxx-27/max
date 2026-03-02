const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../database/init');
const authMiddleware = require('../middleware/auth');
const tokopay = require('../services/tokopay');

// Generate unique order ID
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
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        if (product.stock <= 0) {
            return res.status(400).json({ error: 'Product is out of stock.' });
        }

        const orderId = generateOrderId();

        // Create Tokopay transaction
        const payment = await tokopay.createTransaction(orderId, product.price * 15000, payment_method, {
            productId: product.id.toString(),
            productName: product.name,
        });

        // Insert order
        db.prepare(`
      INSERT INTO orders (order_id, product_id, product_name, amount, payment_method, payment_url, qr_url, status, buyer_email, buyer_name, tokopay_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            orderId,
            product.id,
            product.name,
            product.price,
            payment_method,
            payment.paymentUrl || null,
            payment.qrUrl || null,
            'pending',
            buyer_email || null,
            buyer_name || null,
            payment.reference || null
        );

        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);

        res.status(201).json({
            success: true,
            order,
            payment: {
                url: payment.paymentUrl,
                qr: payment.qrUrl,
                reference: payment.reference
            }
        });
    } catch (err) {
        console.error('Order create error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/orders/:orderId — public, order status
router.get('/:orderId', (req, res) => {
    try {
        const db = getDb();
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(req.params.orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/webhooks/tokopay — Tokopay callback
router.post('/webhook/tokopay', (req, res) => {
    try {
        const data = req.body;
        console.log('🔔 Tokopay webhook received:', data);

        // Verify signature
        const isValid = tokopay.verifyWebhookSignature(data);
        if (!isValid) {
            console.warn('⚠️ Invalid webhook signature');
            return res.status(403).json({ error: 'Invalid signature.' });
        }

        const db = getDb();
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(data.reff_id);

        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        // Update order status
        const newStatus = data.status === 'Paid' || data.status === 'paid' ? 'paid' : data.status.toLowerCase();

        db.prepare(`
      UPDATE orders SET status = ?, tokopay_ref = COALESCE(?, tokopay_ref), updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
    `).run(newStatus, data.trx_id || null, data.reff_id);

        // Decrease stock if paid
        if (newStatus === 'paid') {
            db.prepare('UPDATE products SET stock = MAX(0, stock - 1) WHERE id = ?').run(order.product_id);
        }

        res.json({ success: true, status: newStatus });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/orders — protected, list all orders
router.get('/admin/list', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { status, limit } = req.query;

        let query = 'SELECT * FROM orders';
        const params = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        const orders = db.prepare(query).all(...params);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
