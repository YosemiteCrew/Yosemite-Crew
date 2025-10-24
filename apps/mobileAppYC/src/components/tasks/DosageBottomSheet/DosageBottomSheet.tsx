import React, {forwardRef, useImperativeHandle, useRef, useState, useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, TextInput} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {DosageSchedule} from '@/features/tasks/types';

export interface DosageBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DosageBottomSheetProps {
  dosages: DosageSchedule[];
  onSave: (dosages: DosageSchedule[]) => void;
}

export const DosageBottomSheet = forwardRef<DosageBottomSheetRef, DosageBottomSheetProps>(
  ({dosages, onSave}, ref) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<ConfirmActionBottomSheetRef>(null);
    const [tempDosages, setTempDosages] = useState<DosageSchedule[]>(dosages);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingDosageId, setEditingDosageId] = useState<string | null>(null);
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => bottomSheetRef.current?.open(),
      close: () => bottomSheetRef.current?.close(),
    }));

    const handleAddDosage = () => {
      const newDosage: DosageSchedule = {
        id: `dosage_${Date.now()}`,
        label: `Dose ${tempDosages.length + 1}`,
        time: new Date().toISOString(),
      };
      setTempDosages([...tempDosages, newDosage]);
      setEditingLabelId(newDosage.id);
    };

    const handleRemoveDosage = (id: string) => {
      const filtered = tempDosages.filter(d => d.id !== id);
      setTempDosages(filtered);
    };

    const handleLabelChange = (id: string, newLabel: string) => {
      const updated = tempDosages.map(d =>
        d.id === id ? {...d, label: newLabel} : d,
      );
      setTempDosages(updated);
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }

      if (selectedTime && editingDosageId) {
        const updated = tempDosages.map(d =>
          d.id === editingDosageId ? {...d, time: selectedTime.toISOString()} : d,
        );
        setTempDosages(updated);

        if (Platform.OS === 'ios') {
          setShowTimePicker(false);
          setEditingDosageId(null);
        }
      }
    };

    const handleEditTime = (dosageId: string) => {
      setEditingDosageId(dosageId);
      setShowTimePicker(true);
    };

    const formatTime = (isoTime: string) => {
      try {
        const date = new Date(isoTime);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        return 'Invalid time';
      }
    };

    const handleSave = () => {
      onSave(tempDosages);
      bottomSheetRef.current?.close();
    };

    const currentEditingDosage = tempDosages.find(d => d.id === editingDosageId);

    return (
      <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Dosage"
      snapPoints={['500%']}
      primaryButton={{
        label: "Save",
        onPress: handleSave,
      }}>
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {tempDosages.map((dosage, _index) => (
              <View key={dosage.id} style={styles.dosageRow}>
                <View style={styles.dosageInfo}>
                  {editingLabelId === dosage.id ? (
                    <TextInput
                      style={styles.labelInput}
                      value={dosage.label}
                      onChangeText={text => handleLabelChange(dosage.id, text)}
                      onBlur={() => setEditingLabelId(null)}
                      placeholder="Dose name"
                      placeholderTextColor={theme.colors.textSecondary}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setEditingLabelId(dosage.id)}
                      style={styles.labelTouchable}>
                      <Text style={styles.dosageLabel}>{dosage.label}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.timeButton}
                    onPress={() => handleEditTime(dosage.id)}>
                    <Text style={styles.timeText}>{formatTime(dosage.time)}</Text>
                    <Image source={Images.clockIcon} style={styles.clockIcon} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.removeButton}
                  onPress={() => handleRemoveDosage(dosage.id)}>
                  <Image source={Images.deleteIcon} style={styles.deleteIcon} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.addButton}
              onPress={handleAddDosage}>
              <Image source={Images.addIcon} style={styles.addIcon} />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </ScrollView>

          {showTimePicker && currentEditingDosage && (
            <DateTimePicker
              value={new Date(currentEditingDosage.time)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              textColor={theme.colors.secondary}
            />
          )}
        </View>
      </ConfirmActionBottomSheet>
    );
  },
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing[6],
    },
    dosageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
    },
    dosageInfo: {
      flex: 1,
      gap: theme.spacing[2],
    },
    dosageLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    labelTouchable: {
      paddingVertical: theme.spacing[1],
    },
    labelInput: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '600',
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    timeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      paddingVertical: theme.spacing[2],
    },
    timeText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
    },
    clockIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    removeButton: {
      padding: theme.spacing[2],
    },
    deleteIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.error,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
      paddingVertical: theme.spacing[4],
      marginTop: theme.spacing[2],
    },
    addIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
    addText: {
      ...theme.typography.button,
      color: theme.colors.secondary,
    },
  });

export default DosageBottomSheet;
