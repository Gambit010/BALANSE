import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebase';
import { useTeams } from '../hooks/useTeams';
import { useTheme } from '../context/ThemeContext'; // for dark mode

export default function TeamsScreen({ navigation }) {
  const { teams, loading, create, refetch } = useTeams();
  const [modalVisible, setModalVisible] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const { theme, isDarkMode } = useTheme(); // for dark mode

  const myUid = auth.currentUser?.uid;

  // Refetch whenever the screen regains focus (new teams, new members, etc.)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleCreate = async () => {
    if (!teamName.trim()) {
      Alert.alert('Team name required', 'Please enter a name for your team.');
      return;
    }
    setCreating(true);
    const id = await create(teamName.trim());
    setCreating(false);
    if (id) {
      setTeamName('');
      setModalVisible(false);
    } else {
      Alert.alert('Error', 'Could not create the team. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenTitle, {color:theme.text}]}>Teams</Text>
            <Text style={[styles.screenSubtitle, {color:theme.subtext}]}>Shared task boards for your orgs</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* My Assignments Button */}
            <TouchableOpacity 
              style={[styles.iconButton, {
                backgroundColor: theme.card, 
                borderColor: theme.border, 
                borderWidth: 1,
                marginRight: 8
              }]} 
              onPress={() => navigation.navigate('MyAssignments')}
            >
              <Ionicons name="clipboard" size={20} color={theme.text} />
            </TouchableOpacity>

            {/* New Team Button */}
            <TouchableOpacity 
              style={[styles.newButton, {backgroundColor: theme.accent}]} 
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
              <Text style={styles.newButtonText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
        ) : teams.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color={theme.accent} />
            <Text style={[styles.emptyTitle, {color:theme.text}]}>No teams yet</Text>
            <Text style={[styles.emptyText, {color:theme.subtext}]}>
              Create a team to assign tasks, track progress, and collaborate with your org.
            </Text>
            <TouchableOpacity style={[styles.emptyButton, {backgroundColor:theme.accent}]} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyButtonText}>Create your first team</Text>
            </TouchableOpacity>
          </View>
        ) : (
          teams.map((team) => {
            const memberCount = team.memberIds?.length || team.members?.length || 1;
            const isOwner = team.ownerId === myUid;
            return (
              <TouchableOpacity
                key={team.id}
                style={[styles.teamCard, {backgroundColor: theme.card, borderColor:theme.border}]}
                onPress={() =>
                  navigation.navigate('TeamBoard', { teamId: team.id, teamName: team.name }) 
                }
              >
                <View style={[styles.teamIcon, {backgroundColor: isDarkMode ? 'rgba(167,139,250,0.15)' : '#F3E8FF',}]}>
                  <Text style={[styles.teamIconText, {color:theme.accent}]}>
                    {team.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teamName, {color:theme.text}]}>{team.name}</Text>
                  <Text style={[styles.teamMeta, {color:theme.subtext}]}>
                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                    {isOwner ? '  •  Owner' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* CREATE TEAM MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor:theme.card, borderColor:theme.border}]}>
            <Text style={[styles.modalTitle, {color:theme.text}]}>New Team</Text>
            <Text style={[styles.modalLabel, {color:theme.text}]}>Team Name</Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border
              }]}
              placeholder="e.g. Student Council, CS Org"
              placeholderTextColor={theme.subtext}
              value={teamName}
              onChangeText={setTeamName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel, {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1,
                }]}
                onPress={() => {
                  setModalVisible(false);
                  setTeamName('');
                }}
              >
                <Text style={[styles.modalCancelText, {color:theme.text}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.modalConfirmText}>{creating ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 24,
  },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  screenSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  newButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  teamIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconText: { fontSize: 20, fontWeight: '700', color: '#a78bfa' },
  teamName: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 3 },
  teamMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginTop: 16 },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: '#ffffff', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 18 },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: 'rgba(255,255,255,0.08)' },
  modalCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#7c3aed' },
  modalConfirmText: { color: '#ffffff', fontWeight: '700' },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});