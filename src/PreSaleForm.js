import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';

const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_API_KEY = 'YOUR_API_KEY';
const RANDY_PER_USD = 0.005; // 1 RANDY = $200, so 0.005 RANDY = $1

const PresaleForm = () => {
  const { publicKey, sendTransaction } = useWallet();
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [amount, setAmount] = useState(0);
  const [randyAmount, setRandyAmount] = useState(0);
  const [minPaymentAmount, setMinPaymentAmount] = useState(0);
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  useEffect(() => {
    const fetchAvailableCurrencies = async () => {
      try {
        const response = await axios.get(`${NOWPAYMENTS_API_URL}/currencies`, {
          headers: {
            'x-api-key': NOWPAYMENTS_API_KEY,
          },
        });
        setCurrencies(response.data.currencies);
      } catch (error) {
        console.error('Error fetching available currencies:', error);
      }
    };

    fetchAvailableCurrencies();
  }, []);

  useEffect(() => {
    const fetchMinPaymentAmount = async () => {
      if (selectedCurrency) {
        try {
          const response = await axios.get(`${NOWPAYMENTS_API_URL}/min-amount`, {
            params: {
              currency_from: selectedCurrency,
              currency_to: 'usd',
            },
            headers: {
              'x-api-key': NOWPAYMENTS_API_KEY,
            },
          });
          setMinPaymentAmount(response.data.min_amount);
        } catch (error) {
          console.error('Error fetching minimum payment amount:', error);
        }
      }
    };

    fetchMinPaymentAmount();
  }, [selectedCurrency]);

  useEffect(() => {
    const fetchEstimatedPrice = async () => {
      if (selectedCurrency && amount) {
        try {
          const response = await axios.get(`${NOWPAYMENTS_API_URL}/estimate`, {
            params: {
              amount: amount,
              currency_from: selectedCurrency,
              currency_to: 'usd',
            },
            headers: {
              'x-api-key': NOWPAYMENTS_API_KEY,
            },
          });
          setEstimatedPrice(response.data.estimated_amount);
          setRandyAmount(response.data.estimated_amount * RANDY_PER_USD);
        } catch (error) {
          console.error('Error fetching estimated price:', error);
        }
      }
    };

    fetchEstimatedPrice();
  }, [selectedCurrency, amount]);

  const handleCurrencyChange = (e) => {
    setSelectedCurrency(e.target.value);
  };

  const handleAmountChange = (e) => {
    const inputAmount = parseFloat(e.target.value);
    setAmount(inputAmount);
  };

  const handleBuy = async () => {
    if (!publicKey) {
      alert('Please connect your Phantom wallet');
      return;
    }

    if (estimatedPrice < minPaymentAmount) {
      alert(`The minimum payment amount for ${selectedCurrency} is ${minPaymentAmount}`);
      return;
    }

    try {
      const response = await axios.post(
        `${NOWPAYMENTS_API_URL}/payment`,
        {
          price_amount: amount,
          price_currency: selectedCurrency,
          pay_currency: selectedCurrency,
          ipn_callback_url: 'YOUR_CALLBACK_URL',
          success_url: 'YOUR_SUCCESS_URL',
          order_id: 'YOUR_ORDER_ID',
        },
        {
          headers: {
            'x-api-key': NOWPAYMENTS_API_KEY,
          },
        }
      );

      const paymentId = response.data.payment_id;
      const paymentStatus = response.data.payment_status;
      const paymentAddress = response.data.pay_address;

      // Display the payment details to the user
      alert(`Payment created successfully!
Payment ID: ${paymentId}
Payment Status: ${paymentStatus}
Payment Address: ${paymentAddress}
Please send ${amount} ${selectedCurrency} to the provided address.`);

      // Start checking the payment status periodically
      const checkPaymentStatus = async () => {
        try {
          const statusResponse = await axios.get(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
            headers: {
              'x-api-key': NOWPAYMENTS_API_KEY,
            },
          });

          const updatedPaymentStatus = statusResponse.data.payment_status;

          if (updatedPaymentStatus === 'finished') {
            // Payment is successful, transfer $RANDY to the user's Phantom wallet
            const randyTokenAddress = 'YOUR_RANDY_TOKEN_ADDRESS';
            const transferInstruction = new web3.TransactionInstruction({
              keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: new web3.PublicKey(randyTokenAddress), isSigner: false, isWritable: true },
              ],
              programId: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
              data: Buffer.from(
                Uint8Array.of(0, ...new BN(randyAmount).toArray('le', 8))
              ),
            });

            const transaction = new web3.Transaction().add(transferInstruction);
            const signature = await sendTransaction(transaction, connection);

            alert(`Payment successful! ${randyAmount} $RANDY tokens have been sent to your Phantom wallet.`);
          } else if (updatedPaymentStatus === 'failed' || updatedPaymentStatus === 'expired') {
            alert('Payment failed or expired. Please try again.');
          } else {
            // Payment is still pending, check again after a delay
            setTimeout(checkPaymentStatus, 5000);
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
        }
      };

      checkPaymentStatus();
    } catch (error) {
      console.error('Payment creation failed:', error);
      alert('Payment creation failed. Please try again.');
    }
  };

  return (
    <div>
      <h1>$RANDY Token Presale</h1>
      <WalletMultiButton />
      <br />
      <select value={selectedCurrency} onChange={handleCurrencyChange}>
        <option value="">Select a currency</option>
        {currencies.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
      <br />
      <input type="number" value={amount} onChange={handleAmountChange} placeholder="Enter amount" />
      <br />
      <p>Estimated price: {estimatedPrice} USD</p>
      <p>You will receive: {randyAmount} $RANDY</p>
      <button onClick={handleBuy}>Buy $RANDY</button>
    </div>
  );
};

export default PresaleForm;