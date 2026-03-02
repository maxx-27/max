const crypto = require('crypto');
const fetch = require('node-fetch');

class TokopayService {
    constructor() {
        this.merchantId = process.env.TOKOPAY_MERCHANT_ID;
        this.secret = process.env.TOKOPAY_SECRET;
        this.apiUrl = process.env.TOKOPAY_API_URL || 'https://api.tokopay.id/v1';
    }

    /**
     * Generate signature for Tokopay API
     */
    generateSignature(merchantId, secret) {
        return crypto
            .createHash('md5')
            .update(merchantId + ':' + secret)
            .digest('hex');
    }

    /**
     * Create a payment order via Tokopay
     * @param {string} orderId - Unique order reference
     * @param {number} amount - Amount in IDR
     * @param {string} paymentMethod - Payment channel code (e.g., 'QRIS', 'DANA', 'BRIVA')
     * @param {object} options - Additional options
     */
    async createTransaction(orderId, amount, paymentMethod, options = {}) {
        try {
            const signature = this.generateSignature(this.merchantId, this.secret);

            const channelMap = {
                'QRIS': 'QRIS',
                'DANA': 'DANA',
                'GOPAY': 'GOPAY',
                'OVO': 'OVO',
                'SHOPEEPAY': 'SHOPEEPAY',
                'BRIVA': 'BRIVA',
                'BCAVA': 'BCAVA',
                'BNIVA': 'BNIVA',
                'BSIVA': 'BSIVA',
                'CIMBVA': 'CIMBVA',
                'MANDIRIVA': 'MANDIRIVA',
                'PERMATAVA': 'PERMATAVA',
            };

            const channel = channelMap[paymentMethod] || 'QRIS';

            const payload = {
                merchant_id: this.merchantId,
                kode_channel: channel,
                reff_id: orderId,
                nominal: Math.round(amount),
                items: [
                    {
                        product_code: options.productId || orderId,
                        name: options.productName || 'Premium Product',
                        price: Math.round(amount),
                        product_url: options.productUrl || '',
                        image_url: options.imageUrl || ''
                    }
                ],
                signature
            };

            const response = await fetch(`${this.apiUrl}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.status === 'Success' || data.status === 'success') {
                return {
                    success: true,
                    paymentUrl: data.data?.pay_url || data.data?.checkout_url || null,
                    qrUrl: data.data?.qr_link || data.data?.qr_url || null,
                    reference: data.data?.trx_id || data.data?.panduan_pembayaran || null,
                    raw: data
                };
            } else {
                return {
                    success: false,
                    error: data.message || data.error_msg || 'Transaction failed',
                    raw: data
                };
            }
        } catch (err) {
            console.error('Tokopay API error:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Verify webhook signature from Tokopay
     */
    verifyWebhookSignature(data) {
        // Tokopay sends: signature = md5(merchant_id + ':' + secret + ':' + reff_id)
        const expected = crypto
            .createHash('md5')
            .update(this.merchantId + ':' + this.secret + ':' + data.reff_id)
            .digest('hex');

        return expected === data.signature;
    }
}

module.exports = new TokopayService();
