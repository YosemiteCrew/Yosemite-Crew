
Introduction
Welcome to the docs for @react-native-documents/picker and @react-native-documents/viewer packages. These packages provide a way to pick, save ('save as' dialog) documents and view documents on the device's file system or remote locations.

Originally, there was only react-native-document-picker (see here), but the package was fully rewritten and published in 1/2025 and the viewer package was added.

What's new in the full rewrite?
There's the improved (list of changes below) picker package (called @react-native-documents/picker) with api that's very similar to the original. Secondly, there's the completely new @react-native-documents/viewer package which is designed to work well together with picker.

TypeScript
improved type definitions that make use of Discriminated Unions and other goodies so that you don't try to read fields that are not there, and nullable fields are also reduced. (You can use vanilla JS too if you like.).
mocks for testing
pickSingle method was replaced for more streamlined const [result] = pick()
iOS
new: saveDocuments function
new: isKnownType utility
new: support for long-term file access permissions - across app and even device reboots! (requestLongTermAccess)
new: keepLocalCopy function that separates picking a file and copying it to a local directory. This makes your app more responsive: previously you'd use the copyTo option and before the resulting Promise resolved, you needed to wait not only for user to pick the file, but also for the file to be copied to your app's directory. For large files or with slow network, this could be a problem that you, as a dev don't see, but your users do.
improved: the majority of the code is now written in Swift, making code safer and more readable.
improved: less use of the main thread.
improved: using the new UIDocumentPickerViewController apis instead of those deprecated in iOS 14
improved: instead of the old copyTo parameter making unnecessary copies, the new keepLocalCopy function moves the imported file.
Android
new: saveDocuments function
new: support for open mode
new: support for long-term file access permissions - across app and even device reboots! (requestLongTermAccess)
new: keepLocalCopy function that separates picking a file and copying it to a local directory. This makes your app more responsive: previously you'd use the copyTo option and before the resulting Promise resolved, you needed to wait not only for user to pick the file, but also for the file to be copied to your app's directory. For large files or with slow network, this could be a problem that you, as a dev don't see, but your users do.
new: support for virtual files
improved: deprecated AsyncTask usage was replaced with Kotlin Coroutines.
improved: the code is better at operating with I/O, for example buffering is replaced with a potentially much more efficient alternative from java.nio
improved: reading file metadata is more defensive and efficient because only the necessary columns are queried from ContentResolver. The native Android apis are full of calls that can return null or throw so extra care is taken to handle these cases.
Windows
Windows is not supported at the moment but you can try your luck here. While there was Windows-related code in the public module, it was not maintained and probably does not work.

How do I know it works?
With so many changes, you might wonder if the new package is stable - especially with Android because... well, we know Android 😜.

To prove the new code is solid, I have written an e2e test suite using Appium that covers the majority of the features:

import mode
open mode
viewing files, including long-term permissions

Migrating from the old document-picker
The new package has a new name (@react-native-documents/picker), so you need to update your import statements.

Migrating your code
Good news: You need to make only a few changes:

update import statements
import { ... } from 'react-native-document-picker'

becomes

import { ... } from '@react-native-documents/picker'

Also, if you previously used a default import like this:

import DocumentPicker from 'react-native-document-picker'

you should update it to use named imports for the methods you need (such as pick, keepLocalCopy, etc):

import { pick, keepLocalCopy } from '@react-native-documents/picker'

remove pickSingle
Replace pickSingle with pick:

const result = await pickSingle(options)

becomes:

const [result] = await pick(options)

replace copyTo with keepLocalCopy
This change makes your app more responsive: previously you'd use the copyTo option and before the returned Promise resolved, you needed to wait not only for the user to pick the file, but also for the file to be copied to your app's directory. For large files or with slow network, this could be a problem that you, as a dev don't see, but your users do.

const localCopy = await pick({
  copyTo: 'documentDirectory',
})

becomes

const [file] = await pick()

const [localCopy] = await keepLocalCopy({
  files: [
    {
      uri: file.uri,
      fileName: file.name ?? 'fallbackName',
    },
  ],
  destination: 'documentDirectory',
})

Document Picker
📄️ Save As dialog
saveDocuments presents the user with a dialog to save the provided file(s) to a location of their choice.

📄️ Import mode
Import mode allows you to pick a file from the user's device and keep your own copy of it

📄️ Open mode
Open mode allows you to access the selected documents directly.

📄️ Limiting selectable file types
Limit selectable file types in the document picker

📄️ Keeping a local file copy
keepLocalCopy}

📄️ Directory picker
This module allows you to pick a directory from the file system. The chosen directory can then be used for file I/O operations.

📄️ Android usage notes
The TL;DR version is: the Open and Import modes on Android aren't too different in practice, and you can usually use either one, often combined with keepLocalCopy.

📄️ Virtual files
Virtual files are an Android-only concept. You have almost surely encountered them in your Google Drive - all the Google Docs, Sheets, Presentations, etc. are virtual files and cannot normally be selected.

'Save As' dialog
saveDocuments presents the user with a dialog to save the provided file(s) to a location of their choice.

UI screenshots
This is useful if you want to export some user-generated content (or for example a log file you created during development) from within your app to a user-selected location.

On Android, only one file can be saved at a time but on iOS, multiple files can be saved at once. Read more about the parameters of the function.

How it works
Android
iOS
Uses Intent.ACTION_CREATE_DOCUMENT internally. This is a two-step process: first, the user provides the target (location and name), then the package copies the source to the selected target.

Example: opening a 'Save As' dialog
import { saveDocuments } from '@react-native-documents/picker'
return (
  <Button
    title="Save some text file to a user-defined location"
    onPress={async () => {
      const [{ uri: targetUri }] = await saveDocuments({
        sourceUris: ['some file uri'],
        copy: false,
        mimeType: 'text/plain',
        fileName: 'some file name',
      })
    }}
  />
)

Import mode
Video introduction
Use import mode when you want to pick a file (from the device, cloud storage, etc.) and keep your own copy of it. That means if the original file changes, the copy you have will not change.

If you instead want to keep a reference to the original picked file, use the open mode.

Import mode is the default way to use the module, as in the example below.

picking a file in import mode
import { pick } from '@react-native-documents/picker'
return (
  <Button
    title="single file import"
    onPress={async () => {
      try {
        const [pickResult] = await pick()
        // const [pickResult] = await pick({mode:'import'}) // equivalent
        // do something with the picked file
      } catch (err: unknown) {
        // see error handling
      }
    }}
  />
)

tip
pick(), when it resolves, always returns at least one picked document, and TypeScript won't complain about pickedFile being undefined due to the array destructuring, even with noUncheckedIndexedAccess: true in your tsconfig.json.

Next steps
After importing a file, it's likely that you'll want to work with a local copy of it: see keeping a local copy. This is because on Android, the picked files may point to resources that are not present on the device but in some cloud location. On iOS, the picked files are always downloaded by the system, but they are stored as temporary files that are only available for a short time.

How it works
Android
iOS
Import mode uses Intent.ACTION_GET_CONTENT internally.

Read more about the difference between the two modes in Android integration guide.

With ACTION_GET_CONTENT, the returned uris are file references transient to your activity's current lifecycle. Regardless of the intent type, it is recommended you import a copy that you can read later, using keepLocalCopy.

Import Options
Name	Type	Description
type?	string | PredefinedFileTypes | (PredefinedFileTypes | string)[]	specify file type(s) that you want to pick. Use types for some predefined values.
allowMultiSelection?	boolean	Whether to allow multiple files to be picked
allowVirtualFiles?	boolean	Android only - Whether to allow virtual files (such as Google docs or sheets) to be picked. False by default.
presentationStyle?	PresentationStyle	iOS only - Controls how the picker is presented, e.g. on an iPad you may want to present it fullscreen. Defaults to pageSheet.
transitionStyle?	TransitionStyle	iOS only - Configures the transition style of the picker. Defaults to coverVertical, when the picker is presented, its view slides up from the bottom of the screen.
Import result
The result of the pick function is an array of picked files (the result is the same for both open and import modes). The array has a length of 1 if allowMultiSelection is false (the default), and 1 or more if allowMultiSelection is true.

note
Many of the fields are nullable because the file metadata might not be available in some cases. While it's unlikely, it can happen - especially on Android - if a user picks a file from a Document Provider that doesn't make the information available.

Each picked file is represented by an object with the following properties:

Name	Type	Description
uri	string	The URI of the picked file. Note that it is encoded, so you might need to decode it for further processing.
name	string | null	The name of the picked file, including the extension. It's very unlikely that it'd be null but in theory, it can happen.
size	number | null	The size of the picked file in bytes.
type	string | null	The MIME type of the picked file.
hasRequestedType	boolean	Android: Some Document Providers on Android (especially those popular in Asia, it seems) do not respect the request for limiting selectable file types. hasRequestedType will be false if the user picked a file that does not match one of the requested types. You need to do your own post-processing and display an error to the user if this is important to your app. Always true on iOS.
error	string | null	Error in case the file metadata could not be obtained.
isVirtual	boolean | null	Android: Whether the file is a virtual file (such as Google docs or sheets). Will be null on pre-Android 7.0 devices. On iOS, it's always false.
convertibleToMimeTypes	string[] | null	Android: The target types to which a virtual file can be converted. Useful for keepLocalCopy. This field is only specified if isVirtual is true, and only on Android 7.0+. Always null on iOS.
nativeType	string | null	The "native" type of the picked file: on Android, this is the MIME type. On iOS, it is the UTType identifier.

Open mode
Video introduction
In open mode, the returned uris refer directly to the selected documents.

This is particularly useful when you want to read an existing file without making a copy into your app or when you want to open and edit a file in-place (using the Viewer module).

With requestLongTermAccess, your app is granted long-term read access to the file, also possibly with write access (to be clarified in a later docs update).

Picking a file in open mode
import { pick } from '@react-native-documents/picker'

return (
  <Button
    title="open file"
    onPress={async () => {
      try {
        const [result] = await pick({
          mode: 'open',
        })
        console.log(result)
      } catch (err) {
        // see error handling
      }
    }}
  />
)

How it works
Android
iOS
Open mode uses Intent.ACTION_OPEN_DOCUMENT internally.

Open Options
Name	Type	Description
mode	'open'	specify that you want the picker to function in the "open" mode.
type?	string | PredefinedFileTypes | (PredefinedFileTypes | string)[]	specify file type(s) that you want to pick. Use types for some predefined values.
requestLongTermAccess?	boolean	Whether to ask for long-term access permissions. False by default.
allowMultiSelection?	boolean	Whether to allow multiple files to be picked. False by default.
allowVirtualFiles?	boolean	Android only - Whether to allow virtual files (such as Google docs or sheets) to be picked. False by default.
presentationStyle?	PresentationStyle	iOS only - Controls how the picker is presented, e.g. on an iPad you may want to present it fullscreen. Defaults to pageSheet.
transitionStyle?	TransitionStyle	
Open result
The shape of result is the same for both open and import modes.

note
Many of the fields are nullable because the file metadata might not be available in some cases. While it's unlikely, it can happen - especially on Android - if a user picks a file from a Document Provider that doesn't make the information available.

Each picked file is represented by an object with the following properties:

Name	Type	Description
uri	string	The URI of the picked file. Note that it is encoded, so you might need to decode it for further processing.
name	string | null	The name of the picked file, including the extension. It's very unlikely that it'd be null but in theory, it can happen.
size	number | null	The size of the picked file in bytes.
type	string | null	The MIME type of the picked file.
hasRequestedType	boolean	Android: Some Document Providers on Android (especially those popular in Asia, it seems) do not respect the request for limiting selectable file types. hasRequestedType will be false if the user picked a file that does not match one of the requested types. You need to do your own post-processing and display an error to the user if this is important to your app. Always true on iOS.
error	string | null	Error in case the file metadata could not be obtained.
isVirtual	boolean | null	Android: Whether the file is a virtual file (such as Google docs or sheets). Will be null on pre-Android 7.0 devices. On iOS, it's always false.
convertibleToMimeTypes	string[] | null	Android: The target types to which a virtual file can be converted. Useful for keepLocalCopy. This field is only specified if isVirtual is true, and only on Android 7.0+. Always null on iOS.
nativeType	string | null	The "native" type of the picked file: on Android, this is the MIME type. On iOS, it is the UTType identifier.
Long-term file access
When requestLongTermAccess is set to true, your app will be able to access the file even after the app or device is restarted.

If you've requested long-term access to a directory or file, the response object will contain BookmarkingResponse.

In order to access the same directory or file in the future, you must check bookmarkStatus and store the bookmark opaque string.

Advanced
When you want to access the file later (for example in your own native module), you can use the bookmark to resolve the file uri. See the Document viewer source on how to do it, if you need this.

Request long-term access to a file
import { pick, types } from '@react-native-documents/picker'

return (
  <Button
    title="open pdf file with requestLongTermAccess: true"
    onPress={async () => {
      try {
        const [result] = await pick({
          mode: 'open',
          requestLongTermAccess: true,
          type: [types.pdf],
        })
        if (result.bookmarkStatus === 'success') {
          const bookmarkToStore = {
            fileName: result.name ?? 'unknown name',
            bookmark: result.bookmark,
          }
          localStorage.set('bookmark', JSON.stringify(bookmarkToStore))
        } else {
          console.error(result)
        }
      } catch (err) {
        // see error handling
      }
    }}
  />
)

Releasing Long Term Access
This is an Android-only feature. When you no longer need access to the file or location, you should release the long-term access by calling releaseLongTermAccess. Calling this on iOS will resolve.

See Android documentation for more information.

Releasing (stopping) Secure Access
This is an iOS-only feature. When you no longer need access to the file or location, you should release the secure access by calling releaseSecureAccess. Calling this on Android will resolve.

See iOS documentation for more information.

Limiting selectable file types
Video introduction
The default document picker allows any file to be selected (except virtual files). Use the type parameter of pick() to restrict the selectable file types.

On iOS, these are Apple Uniform Type Identifiers such as public.plain-text.

On Android, these are MIME types such as text/plain or partial MIME types such as image/*. See common MIME types or a more comprehensive IANA Media Types listing.

Figuring out the correct MIME type or UTType identifier for a file type can be a bit of a hassle. To make it easier, the module exports the isKnownType utility and several predefined file types that you can use.

warning
On Android, some Document Providers (this seems to be a problem especially in Asia) ignore the type parameter and allow any file to be selected. This is a problem with the Document Provider, not this module.

To detect this case, check the hasRequestedType field and handle the situation in your app.

Limiting selectable file types to pdf and docx
import { pick, types } from '@react-native-documents/picker'

return (
  <Button
    title="import multiple docx or pdf files"
    onPress={() => {
      pick({
        allowMultiSelection: true,
        type: [types.pdf, types.docx],
      })
        .then((res) => {
          const allFilesArePdfOrDocx = res.every((file) => file.hasRequestedType)
          if (!allFilesArePdfOrDocx) {
            // tell the user they selected a file that is not a pdf or docx
          }
          addResult(res)
        })
        .catch(handleError)
    }}
  />
)

isKnownType
isKnownType is a handy utility function that given one of:

UTType identifier string
MIME type string
File extension string
returns the corresponding MIME type, file extension, and UTType identifier.

import { isKnownType } from '@react-native-documents/picker'

const { isKnown, mimeType, preferredFilenameExtension } = isKnownType({
  kind: 'extension',
  value: 'pdf',
})

If you know the file extension (or the MIME, or the UTType), then use isKnownType to find the corresponding MIME type for Android or UTType for iOS. Then pass the result to the type parameter of pick.

note
Prefer using the iOS implementation of isKnownType. On Android, the function does not provide UTType identifier information (as it's an iOS-only concept) and the results may not be as accurate.

Different devices, based on the installed apps, may recognize different file types.

Predefined File Types
These are the most common file types, and are available in the types export. See the usage example above.

import { types } from '@react-native-documents/picker'

types.allFiles: All document types, on Android this is */*, on iOS it's public.item
types.images: All image types
types.plainText: Plain text files
types.audio: All audio types
types.video: All video types
types.pdf
types.zip
types.csv
types.json
types.doc
types.docx
types.ppt
types.pptx
types.xls
types.xlsx


Keeping a local copy of the picked files
keepLocalCopy makes the file available in the app's storage. The behavior is different on iOS and Android:

Android
iOS
This method opens an InputStream pointing to the picked content:// uri (from both Open and Import modes) and stores its bytes into a file - i.e. it can be used to "convert" a content:// Uri into a local file. This file's location is determined by the destination parameter.

It also "converts" virtual files (such as Google Docs or sheets) into local files.

note
For each call of keepLocalCopy, a new unique directory is created in the app's storage, and the files are placed into it.

This way, the files are isolated and subsequent calls to keepLocalCopy with the same file names do not overwrite the previous files.

When writing to the filesystem, path traversal vulnerability is prevented. Writing files outside the intended destination will error.

Example: keeping a local copy of the picked file
import { pick, keepLocalCopy } from '@react-native-documents/picker'
return (
  <Button
    title="single file import, and ensure it is available in the local storage"
    onPress={async () => {
      try {
        const [{ name, uri }] = await pick()

        const [copyResult] = await keepLocalCopy({
          files: [
            {
              uri,
              fileName: name ?? 'fallback-name',
            },
          ],
          destination: 'documentDirectory',
        })
        if (copyResult.status === 'success') {
          // do something with the local copy:
          console.log(copyResult.localUri)
        }
      } catch (err) {
        // see error handling
      }
    }}
  />
)

Keeping a local copy of the picked files
keepLocalCopy makes the file available in the app's storage. The behavior is different on iOS and Android:

Android
iOS
On iOS, keepLocalCopy is only supported for the Import mode at the moment.

Calling this method is strongly recommended, though not strictly necessary, as the file is already temporarily available in a location in the app's sandbox when it is picked. However, iOS appears to delete the file rather soon after it is returned to your app, hence the recommendation.

keepLocalCopy is useful if you need to prevent / delay the file being deleted by the system (by moving it to the app's Documents / Cache directory, respectively).

To prevent deletion, call keepLocalCopy() and pass destination: "documentDirectory". This moves the file from the temporary location it is in when it is picked, into Documents directory, where the file lives until the app is uninstalled.

note
For each call of keepLocalCopy, a new unique directory is created in the app's storage, and the files are placed into it.

This way, the files are isolated and subsequent calls to keepLocalCopy with the same file names do not overwrite the previous files.

When writing to the filesystem, path traversal vulnerability is prevented. Writing files outside the intended destination will error.

Example: keeping a local copy of the picked file
import { pick, keepLocalCopy } from '@react-native-documents/picker'
return (
  <Button
    title="single file import, and ensure it is available in the local storage"
    onPress={async () => {
      try {
        const [{ name, uri }] = await pick()

        const [copyResult] = await keepLocalCopy({
          files: [
            {
              uri,
              fileName: name ?? 'fallback-name',
            },
          ],
          destination: 'documentDirectory',
        })
        if (copyResult.status === 'success') {
          // do something with the local copy:
          console.log(copyResult.localUri)
        }
      } catch (err) {
        // see error handling
      }
    }}
  />
)

Directory picker
This module allows you to pick a directory from the file system. The chosen directory can then be used for file I/O operations.

When requestLongTermAccess is set to true, your app will be able to access the directory even after the app is restarted.

If you've requested long-term access to a directory or file, the response object will contain BookmarkingResponse.

Please note there are some security limitations.

Selecting a directory
import { pickDirectory } from '@react-native-documents/picker'

return (
  <Button
    title="open directory"
    onPress={async () => {
      try {
        const { uri } = await pickDirectory({
          requestLongTermAccess: false,
        })
        // do something with the uri
      } catch (err) {
        // see error handling section
        console.error(err)
      }
    }}
  />
)

How it works
Android
iOS
Open mode uses Intent.ACTION_OPEN_DOCUMENT_TREE internally.

Writing to the directory location
In order to write to the user-selected location, this approach needs to be used:

on Android: https://stackoverflow.com/a/61120265
on iOS: docs
Releasing Long Term Access
This is an Android-only feature. When you no longer need access to the file or location, you should release the long-term access by calling releaseLongTermAccess. Calling this on iOS will resolve.

See Android documentation for more information.

Releasing (stopping) Secure Access
This is an iOS-only feature. When you no longer need access to the file or location, you should release the secure access by calling releaseSecureAccess. Calling this on Android will resolve.

See iOS documentation for more information.

Virtual files
Virtual files are an Android-only concept. You have almost surely encountered them in your Google Drive - all the Google Docs, Sheets, Presentations, etc. are virtual files and cannot normally be selected.

Pass allowVirtualFiles: true to the pick function to allow picking virtual files in import mode.

When a virtual file is picked, the isVirtual field is true, and the convertibleToMimeTypes field contains an array of VirtualFileMeta.

This array describes what kind(s) of regular file the virtual file can be exported into - for example, Google Docs files can be exported as application/pdf and so the array will be [{ mimeType: 'application/pdf', extension: 'pdf' }].

note
Picking virtual files is supported since Android 7.0.

Obtaining a regular file from a virtual file
If you want to export a virtual file into a local one, use the keepLocalCopy function and

double-check that the fileName parameter includes the extension.
pass a mimeType value to the convertVirtualFileToType parameter.
Picking a virtual file and exporting it to a local one
<Button
  title="import virtual file (such as a document from GDrive)"
  onPress={async () => {
    const [file] = await pick({
      allowVirtualFiles: true,
    })
    const { name, uri: pickedUri, convertibleToMimeTypes } = file

    const virtualFileMeta = convertibleToMimeTypes && convertibleToMimeTypes[0]
    invariant(name && virtualFileMeta, 'name and virtualFileMeta is required')
    const [copyResult] = await keepLocalCopy({
      files: [
        {
          uri: pickedUri,
          fileName: `${name}.${virtualFileMeta.extension ?? ''}`,
          convertVirtualFileToType: virtualFileMeta.mimeType,
        },
      ],
      destination: 'cachesDirectory',
    })
    if (copyResult.status === 'success') {
      const localCopy = copyResult.localUri
      // do something with the local copy
    }
  }}
/>

For viewing or editing of virtual files you'll need to rely on the app that provided the virtual file (for example, Google Docs app for Google Docs files). The Document Viewer module can help you with that.

Learn more about virtual files in this video.

Jest module mocks
You will need to mock the functionality of the native modules once you require them from your test files - otherwise you'll get this error.

The packages provide Jest mocks that you can add to the setupFiles array in the Jest config.

By default, the mocks behave as if the calls were successful and return mock document data.

jest.config
{
  "setupFiles": [
    "./node_modules/@react-native-documents/picker/jest/build/jest/setup.js",
    "./node_modules/@react-native-documents/viewer/jest/build/jest/setup.js"
  ]
}

Error handling
This page describes the case when calling any of the modules' method rejects. Keep in mind other errors can also happen in pick (see error and hasRequestedType) and keepLocalCopy (see copyError).

Error codes
Both picker and viewer expose the errorCodes object which contains an object of possible error codes that can be returned by the native module.

Error codes are useful when determining which kind of error has occurred during the picking or viewing process.

Error Code Key	Description
IN_PROGRESS	This is rather a warning, that happens when you invoke an operation (e.g. pick) while a previous one has not finished yet. For example: if you call pick() quickly twice in a row, 2 calls to pick() in the native module will be done. The first call will open the native document picker and user action will be expected. The promise from the second call to pick will be rejected with this error. Later, the first promise will resolve (or reject) with the actual files that the user has selected. Only one document picker window will be presented to the user. The reason the module explicitly rejects "duplicated" calls is to avoid memory leaks and to inform you that something probably isn't done right.
UNABLE_TO_OPEN_FILE_TYPE	When you try to use the picker or viewer using a configuration that system cannot comply with. On Android, this corresponds to ActivityNotFoundException. On iOS, this only happens in the Viewer module when you attempt to preview a file that's not supported by the QuickLook framework.
OPERATION_CANCELED	When user cancels the operation
note
In a future release, OPERATION_CANCELED will be replaced with a more streamlined cancellation handling. I'm keeping it now to make migration easier.

error-handling.ts
import { errorCodes } from '@react-native-documents/picker'
// or
import { errorCodes } from '@react-native-documents/viewer'

const handleError = (err: unknown) => {
  if (isErrorWithCode(err)) {
    switch (err.code) {
      case errorCodes.IN_PROGRESS:
        console.warn('user attempted to present a picker, but a previous one was already presented')
        break
      case errorCodes.UNABLE_TO_OPEN_FILE_TYPE:
        setError('unable to open file type')
        break
      case errorCodes.OPERATION_CANCELED:
        // ignore
        break
      default:
        setError(String(err))
        console.error(err)
    }
  } else {
    setError(String(err))
  }
}


isErrorWithCode(value)
TypeScript helper to check if the passed parameter is an instance of Error which has the code property. All errors thrown by the picker and viewer native modules have the code property, which contains a value from errorCodes or some other string for the less-usual errors.

isErrorWithCode can be used to avoid as casting when you want to access the code property on errors returned by the module.

import { pick, isErrorWithCode } from '@react-native-documents/picker'

try {
  const [pickResult] = await pick()
  // do something with pickResult
} catch (error) {
  if (isErrorWithCode(error)) {
    // here you can safely read `error.code` and TypeScript will know that it has a value
  } else {
    // this error does not have a `code`, and does not come from the native module
  }
}