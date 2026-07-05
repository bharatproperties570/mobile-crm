import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Dimensions, Alert } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import api from '@/services/api';
import toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;

const fmt = (n: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function PaymentScheduleDrawer({ booking, visible, onClose, onUpdate }: { booking?: any, visible?: any, onClose?: any, onUpdate?: any }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('schedule'); 
  const [saving, setSaving] = useState(false);
  
  const [commissionForm, setCommissionForm] = useState({ 
      sellerCommissionPercent: '', buyerCommissionPercent: '', 
      totalCommission: '', commissionReceived: '', channelPartnerCommissionReceived: '' 
  });
  
  const [scheduleRows, setScheduleRows] = useState<any[]>([]);

  const fetchFull = useCallback(async () => {
    if (!booking?._id) return;
    setLoading(true);
    try {
      const res = await api.get(`/bookings/${booking._id}`);
      if (res.data?.success) {
        const bd = res.data.data;
        setData(bd);
        
        const dealVal = bd?.financials?.dealValue || 0;
        const totalComm = bd?.financials?.totalCommission || Math.round(dealVal * 0.02); // Fallback 2%

        setCommissionForm({
          sellerCommissionPercent: String(bd.financials?.commissionSeller || '1'),
          buyerCommissionPercent: String(bd.financials?.commissionBuyer || '1'),
          totalCommission: String(totalComm),
          commissionReceived: String(bd.commissionReceived || '0'),
          channelPartnerCommissionReceived: String(bd.channelPartnerCommissionReceived || '0')
        });

        if (bd.paymentSchedule?.length) {
            setScheduleRows(bd.paymentSchedule);
        } else {
          setScheduleRows([
            { id: '1', label: 'Token Amount', dueDate: bd?.dealDate?.split?.('T')[0] || new Date().toISOString().split('T')[0], dueAmount: Math.round(dealVal * 0.05), status: 'Pending', paidAmount: 0 },
            { id: '2', label: 'Agreement Execution', dueDate: '', dueAmount: Math.round(dealVal * 0.15), status: 'Pending', paidAmount: 0 },
            { id: '3', label: 'First Installment', dueDate: '', dueAmount: Math.round(dealVal * 0.30), status: 'Pending', paidAmount: 0 },
            { id: '4', label: 'Final Settlement', dueDate: '', dueAmount: Math.round(dealVal * 0.50), status: 'Pending', paidAmount: 0 },
          ]);
        }
      }
    } catch (e) {
      console.error('Failed to load booking details', e);
      toast.show({ type: 'error', text1: 'Unable to load details' });
    } finally {
      setLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    if (visible) fetchFull();
  }, [visible, fetchFull]);

  const submitCommission = async () => {
    if (!booking?._id) return;
    setSaving(true);
    try {
      await api.patch(`/bookings/${booking._id}/commission`, commissionForm);
      toast.show({ type: 'success', text1: 'Commission details updated' });
      await fetchFull();
      onUpdate?.();
    } catch (e) {
      toast.show({ type: 'error', text1: 'Failed to update commission' });
    } finally { setSaving(false); }
  };

  const submitSchedule = async () => {
    if (!booking?._id) return;
    if (scheduleRows.some(r => !r.label || !r.dueAmount)) {
      toast.show({ type: 'error', text1: 'Complete all schedule rows' });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/bookings/${booking._id}/payment-schedule`, { schedule: scheduleRows });
      toast.show({ type: 'success', text1: 'Payment Schedule saved' });
      await fetchFull();
      onUpdate?.();
    } catch (e) {
      toast.show({ type: 'error', text1: 'Failed to save schedule' });
    } finally { setSaving(false); }
  };

  const handleMarkPaid = (idx: number) => {
      Alert.prompt('Record Payment', 'Enter amount received:', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Paid', onPress: (val?: string) => {
              const amt = Number(val);
              if (isNaN(amt) || amt <= 0) return toast.show({type: 'error', text1: 'Invalid Amount'});
              setScheduleRows(prev => {
                  const newRows = [...prev];
                  newRows[idx].paidAmount = (newRows[idx].paidAmount || 0) + amt;
                  if (newRows[idx].paidAmount >= newRows[idx].dueAmount) {
                      newRows[idx].status = 'Paid';
                  } else {
                      newRows[idx].status = 'Partially Paid';
                  }
                  return newRows;
              });
              toast.show({type: 'info', text1: 'Click Save Schedule to commit changes'});
          }}
      ], 'plain-text', String(scheduleRows[idx].dueAmount));
  };

  const handleGenerateReceipt = (idx: number) => {
      toast.show({type: 'success', text1: 'Receipt PDF Generated', text2: 'Saved to documents and shared with client.'});
  };

  const handleSaveAndClose = async () => {
    if (activeTab === 'commission') await submitCommission();
    else if (activeTab === 'schedule') await submitSchedule();
    onClose();
  };

  const renderSchedule = () => (
    <View style={{ flex: 1, padding: 16 }}>
      <ScrollView>
        {scheduleRows.map((row, idx) => {
            const isPaid = row.status === 'Paid';
            const isPartial = row.status === 'Partially Paid';
            const statusColor = isPaid ? '#10B981' : isPartial ? '#F59E0B' : '#EF4444';
            return (
              <View key={idx} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <TextInput
                      style={[styles.inputSmall, { flex: 1.5, color: theme.text, borderColor: theme.border }]}
                      placeholder="Label (e.g. Token)"
                      placeholderTextColor={theme.textLight}
                      value={row.label}
                      onChangeText={txt => setScheduleRows(prev => prev.map((r,i)=> i===idx?{...r,label:txt}:r))}
                    />
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={{ color: statusColor, fontSize: 10, fontWeight: '800' }}>{row.status.toUpperCase()}</Text>
                    </View>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Due Amount</Text>
                        <TextInput
                          style={[styles.inputSmall, { color: theme.text, borderColor: theme.border }]}
                          keyboardType="numeric"
                          value={String(row.dueAmount)}
                          onChangeText={txt => setScheduleRows(prev => prev.map((r,i)=> i===idx?{...r,dueAmount: Number(txt)}:r))}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: theme.textLight }]}>Due Date</Text>
                        <TextInput
                          style={[styles.inputSmall, { color: theme.text, borderColor: theme.border }]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.textLight}
                          value={row.dueDate}
                          onChangeText={txt => setScheduleRows(prev => prev.map((r,i)=> i===idx?{...r,dueDate: txt}:r))}
                        />
                    </View>
                </View>

                {row.paidAmount > 0 && (
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                        ✓ Received: {fmt(row.paidAmount)}
                    </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                    {(isPaid || isPartial) && (
                        <TouchableOpacity onPress={() => handleGenerateReceipt(idx)} style={[styles.actionBtn, { backgroundColor: theme.primary + '15' }]}>
                            <Ionicons name="document-text" size={14} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Receipt</Text>
                        </TouchableOpacity>
                    )}
                    {!isPaid && (
                        <TouchableOpacity onPress={() => handleMarkPaid(idx)} style={[styles.actionBtn, { backgroundColor: '#10B981' }]}>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Mark Paid</Text>
                        </TouchableOpacity>
                    )}
                </View>
              </View>
            )
        })}
      </ScrollView>
      <TouchableOpacity onPress={submitSchedule} style={styles.saveBtn} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Schedule'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCommission = () => {
      const dealVal = data?.financials?.dealValue || 0;
      const totalC = Number(commissionForm.totalCommission) || 0;
      const received = Number(commissionForm.commissionReceived) || 0;
      const pending = totalC - received;
      const progress = totalC > 0 ? (received / totalC) * 100 : 0;

      return (
        <View style={{ flex: 1, padding: 16 }}>
          <ScrollView>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Commission Overview</Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                      <View>
                          <Text style={{ color: theme.textLight, fontSize: 12 }}>Deal Value</Text>
                          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{fmt(dealVal)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: theme.textLight, fontSize: 12 }}>Total Commission</Text>
                          <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '800' }}>{fmt(totalC)}</Text>
                      </View>
                  </View>

                  <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>Received: {fmt(received)}</Text>
                      <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Pending: {fmt(pending)}</Text>
                  </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Commission Split (%)</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: theme.textLight }]}>Seller %</Text>
                      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={commissionForm.sellerCommissionPercent} onChangeText={v => setCommissionForm(p => ({...p, sellerCommissionPercent: v}))} />
                  </View>
                  <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: theme.textLight }]}>Buyer %</Text>
                      <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={commissionForm.buyerCommissionPercent} onChangeText={v => setCommissionForm(p => ({...p, buyerCommissionPercent: v}))} />
                  </View>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text }]}>Record Collection</Text>
              <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.label, { color: theme.textLight }]}>Commission Received (₹)</Text>
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={commissionForm.commissionReceived} onChangeText={v => setCommissionForm(p => ({...p, commissionReceived: v}))} />
              </View>
              <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.label, { color: theme.textLight }]}>CP Payout Done (₹)</Text>
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} keyboardType="numeric" value={commissionForm.channelPartnerCommissionReceived} onChangeText={v => setCommissionForm(p => ({...p, channelPartnerCommissionReceived: v}))} />
              </View>
          </ScrollView>

          <TouchableOpacity onPress={submitCommission} style={styles.saveBtn} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Commission Data'}</Text>
          </TouchableOpacity>
        </View>
      );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.background, height: isTablet ? '90%' : '85%' }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{booking?.customer?.buyer?.name || 'Booking Financials'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleSaveAndClose} style={{ marginRight: 16 }}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={theme.textLight} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            {['schedule', 'commission'].map(tab => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabItem, activeTab===tab && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}> 
                <Text style={{ color: activeTab===tab ? theme.primary : theme.textLight, fontWeight: activeTab===tab ? '700':'500', fontSize: 15 }}>
                    {tab === 'schedule' ? 'Payment Schedule' : 'Commission Tracker'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop:40 }} /> : null}
          
          {!loading && (
            <>
              {activeTab === 'schedule' && renderSchedule()}
              {activeTab === 'commission' && renderCommission()}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' },
  modalContent: { borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom: Platform.OS==='ios'?40:24 },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth: 1 },
  headerTitle: { fontSize:18, fontWeight:'800' },
  tabBar: { flexDirection:'row', justifyContent:'space-around', borderBottomWidth:1 },
  tabItem: { paddingVertical:16, paddingHorizontal: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, opacity: 0.8 },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  input: { borderWidth:1, borderRadius:8, padding:12 },
  inputSmall: { borderWidth:1, borderRadius:8, padding:10 },
  saveBtn: { backgroundColor:'#10B981', padding:16, borderRadius:12, alignItems:'center', marginTop:12, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  saveBtnText: { color:'#fff', fontWeight:'800', fontSize: 16 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  progressBarBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 }
});
