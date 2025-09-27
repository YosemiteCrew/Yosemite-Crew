import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Input} from '../../../components';
import {useTheme, useAuth} from '../../../hooks';
import {AuthStackScreenProps} from '../../../navigation/types';

type Props = AuthStackScreenProps<'Login'>;

export const LoginScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {login, isLoading, error} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      await login({email: email.trim(), password});
    } catch (err) {
      console.log(err)
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['12'],
    },
    header: {
      marginBottom: theme.spacing['12'],
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    form: {
      flex: 1,
    },
    inputContainer: {
      marginBottom: theme.spacing['4'],
    },
    buttonContainer: {
      marginTop: theme.spacing['8'],
      marginBottom: theme.spacing['6'],
    },
    footer: {
      paddingBottom: theme.spacing['8'],
    },
    footerText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    linkText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.error,
      textAlign: 'center',
      marginTop: theme.spacing['2'],
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>
                Sign in to your account to continue
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="Enter your email"
                error={emailError}
                containerStyle={styles.inputContainer}
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="Enter your password"
                error={passwordError}
                containerStyle={styles.inputContainer}
              />

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <View style={styles.buttonContainer}>
                <Button
                  title="Sign In"
                  onPress={handleLogin}
                  loading={isLoading}
                  disabled={isLoading}
                />
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('Register')}>
                  Sign Up
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};