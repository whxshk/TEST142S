import React, { useState } from 'react';
import { View, Text, Button, TextInput, StyleSheet } from 'react-native';
import { transactionsApi } from '../api/client';
import { v4 as uuidv4 } from 'react-native-uuid';

export default function ScanScreen() {
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleIssuePoints = async () => {
    try {
      const idempotencyKey = uuidv4();
      const response = await transactionsApi.issuePoints(
        customerId,
        parseFloat(amount),
        null,
        idempotencyKey,
      );
      setResult(response.data);
    } catch (error: any) {
      setResult({ error: error.response?.data?.error?.message || 'Failed to issue points' });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Transaction</Text>
      <TextInput
        style={styles.input}
        placeholder="Customer ID"
        value={customerId}
        onChangeText={setCustomerId}
      />
      <TextInput
        style={styles.input}
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <Button title="Issue Points" onPress={handleIssuePoints} />
      {result && (
        <View style={styles.result}>
          <Text>{JSON.stringify(result, null, 2)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  result: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
});
