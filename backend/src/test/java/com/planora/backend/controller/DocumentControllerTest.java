package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.*;
import com.planora.backend.exception.StorageQuotaExceededException;
import com.planora.backend.service.DocumentService;
import com.planora.backend.service.DocumentBatchUploadService;
import com.planora.backend.service.JWTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetailsService;
import com.planora.backend.annotation.WithMockUserPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DocumentController.class)
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

        @MockBean
    private DocumentService documentService;

    @MockBean
    private DocumentBatchUploadService documentBatchUploadService;

        @MockBean
    private JWTService jwtService;

        @MockBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private DocumentResponseDTO sampleDoc;
    private DocumentFolderResponseDTO sampleFolder;

    @BeforeEach
    void setUp() {
        sampleDoc = DocumentResponseDTO.builder()
                .id(1L)
                .name("spec.pdf")
                .projectId(10L)
                .build();

        sampleFolder = DocumentFolderResponseDTO.builder()
                .id(1L)
                .name("Requirements")
                .build();
    }

    @Test
    @WithMockUserPrincipal
    void initUpload_returns200WithPresignedUrl() throws Exception {
        DocumentUploadInitRequestDTO req = new DocumentUploadInitRequestDTO();
        req.setFileName("spec.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(50000L);

        DocumentUploadInitResponseDTO resp = DocumentUploadInitResponseDTO.builder()
                .uploadUrl("https://s3.example.com/presigned")
                .objectKey("project-10/uuid-spec.pdf")
                .build();

        when(documentService.initUpload(eq(10L), any(), any())).thenReturn(resp);

        mockMvc.perform(post("/api/projects/10/documents/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objectKey").value("project-10/uuid-spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void finalizeUpload_returns201WithDocument() throws Exception {
        DocumentUploadFinalizeRequestDTO req = new DocumentUploadFinalizeRequestDTO();
        req.setFileName("spec.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(50000L);
        req.setObjectKey("project-10/uuid-spec.pdf");

        when(documentService.finalizeUpload(eq(10L), any(), any())).thenReturn(sampleDoc);

        mockMvc.perform(post("/api/projects/10/documents/upload/finalize")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void listDocuments_returns200WithDocumentList() throws Exception {
        when(documentService.listDocuments(eq(10L), any(), any(), anyBoolean())).thenReturn(List.of(sampleDoc));

        mockMvc.perform(get("/api/projects/10/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void getDocumentById_returns200WithDocument() throws Exception {
        when(documentService.getDocumentById(eq(10L), eq(1L), any())).thenReturn(sampleDoc);

        mockMvc.perform(get("/api/projects/10/documents/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getDownloadUrl_returns200WithUrl() throws Exception {
        when(documentService.getDownloadUrl(eq(10L), eq(1L), any())).thenReturn("https://cdn.example.com/spec.pdf?sig=abc");

        mockMvc.perform(get("/api/projects/10/documents/1/download-url"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.downloadUrl").value("https://cdn.example.com/spec.pdf?sig=abc"));
    }

    @Test
    @WithMockUserPrincipal
    void getVersions_returns200WithVersionList() throws Exception {
        DocumentVersionResponseDTO version = DocumentVersionResponseDTO.builder()
                .id(5L)
                .versionNumber(1)
                .downloadUrl("https://cdn.example.com/spec-v1.pdf")
                .build();
        when(documentService.getVersions(eq(10L), eq(1L), any())).thenReturn(List.of(version));

        mockMvc.perform(get("/api/projects/10/documents/1/versions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].versionNumber").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void softDelete_returns204() throws Exception {
        doNothing().when(documentService).softDelete(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/documents/1").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void restore_returns200WithDocument() throws Exception {
        when(documentService.restore(eq(10L), eq(1L), any())).thenReturn(sampleDoc);

        mockMvc.perform(patch("/api/projects/10/documents/1/restore").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void permanentDelete_returns204() throws Exception {
        doNothing().when(documentService).permanentDelete(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/documents/1/permanent").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void createFolder_returns201WithFolder() throws Exception {
        DocumentFolderCreateRequestDTO req = new DocumentFolderCreateRequestDTO();
        req.setName("Requirements");
        when(documentService.createFolder(eq(10L), any(), any())).thenReturn(sampleFolder);

        mockMvc.perform(post("/api/projects/10/folders")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Requirements"));
    }

    @Test
    @WithMockUserPrincipal
    void listFolders_returns200WithFolderList() throws Exception {
        when(documentService.listFolders(eq(10L), any())).thenReturn(List.of(sampleFolder));

        mockMvc.perform(get("/api/projects/10/folders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Requirements"));
    }

    @Test
    @WithMockUserPrincipal
    void getFolderPermissions_returns200WithPermissionList() throws Exception {
        List<FolderPermissionRequest> permissions = List.of(new FolderPermissionRequest("MEMBER", List.of("READ", "WRITE")));
        when(documentService.getFolderPermissions(eq(10L), eq(1L), any())).thenReturn(permissions);

        mockMvc.perform(get("/api/projects/10/folders/1/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].teamRole").value("MEMBER"))
                .andExpect(jsonPath("$[0].permissions[0]").value("READ"));
    }

    @Test
    @WithMockUserPrincipal
    void updateFolderPermissions_returns200() throws Exception {
        List<FolderPermissionRequest> permissions = List.of(new FolderPermissionRequest("MEMBER", List.of("READ")));

        mockMvc.perform(put("/api/projects/10/folders/1/permissions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(permissions)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Folder permissions updated"));

        verify(documentService).updateFolderPermissions(eq(10L), eq(1L), any(), eq(permissions));
    }

    @Test
    @WithMockUserPrincipal
    void getStorageQuota_returns200WithQuota() throws Exception {
        ProjectStorageQuotaResponseDTO quota = ProjectStorageQuotaResponseDTO.builder()
                .usedBytes(1024L)
                .quotaBytes(5L * 1024 * 1024 * 1024)
                .maxFileSizeBytes(100L * 1024 * 1024)
                .documentCount(2L)
                .humanReadableUsed("1.0 KB")
                .humanReadableQuota("5.0 GB")
                .build();
        when(documentService.getStorageQuota(eq(10L), any())).thenReturn(quota);

        mockMvc.perform(get("/api/projects/10/storage-quota"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quotaBytes").value(5368709120L));
    }

    @Test
    @WithMockUserPrincipal
    void uploadViaBackend_returns201WithDocument() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "spec.pdf", "application/pdf", "PDF".getBytes());
        when(documentService.uploadDocumentViaBackend(eq(10L), any(), any(), eq(1L))).thenReturn(sampleDoc);

        mockMvc.perform(multipart("/api/projects/10/documents/upload")
                        .file(file)
                        .param("folderId", "1")
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteFolder_returns204() throws Exception {
        doNothing().when(documentService).deleteFolder(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/folders/1").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void initUpload_invalidPayload_returns400() throws Exception {
        DocumentUploadInitRequestDTO req = new DocumentUploadInitRequestDTO();
        req.setFileName(""); // Blank filename
        req.setContentType("invalid/type"); // Unsupported type
        req.setFileSize(-50L); // Negative file size

        mockMvc.perform(post("/api/projects/10/documents/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"));
    }

    @Test
    @WithMockUserPrincipal
    void initUpload_whenQuotaExceeded_returns413WithErrorCode() throws Exception {
        DocumentUploadInitRequestDTO req = new DocumentUploadInitRequestDTO();
        req.setFileName("spec.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(50000L);

        when(documentService.initUpload(eq(10L), any(), any()))
                .thenThrow(new StorageQuotaExceededException("Project storage quota exceeded."));

        mockMvc.perform(post("/api/projects/10/documents/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.errorCode").value("STORAGE_QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.message").value("Project storage quota exceeded."));
    }

    @Test
    @WithMockUserPrincipal
    void updateMetadata_invalidPayload_returns400() throws Exception {
        DocumentMetadataUpdateRequestDTO req = new DocumentMetadataUpdateRequestDTO();
        req.setFolderId(-5L); // Negative folder ID

        mockMvc.perform(patch("/api/projects/10/documents/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"));
    }

    @Test
    @WithMockUserPrincipal
    void updateFolderPermissions_invalidPayload_returns400() throws Exception {
        List<FolderPermissionRequest> invalidPermissions = List.of(
                new FolderPermissionRequest("INVALID_ROLE", List.of("READ"))
        );

        mockMvc.perform(put("/api/projects/10/folders/1/permissions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidPermissions)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"));
    }

    @ParameterizedTest(name = "{0} returns 403 when service denies access")
    @MethodSource("authorizationDeniedRoutes")
    @WithMockUserPrincipal
    void dmsRoutes_return403WhenAuthorizationFails(String routeName, RequestBuilder requestBuilder) throws Exception {
        AccessDeniedException denied = new AccessDeniedException("Permission denied");

        switch (routeName) {
            case "getFolderPermissions" -> when(documentService.getFolderPermissions(eq(10L), eq(1L), any())).thenThrow(denied);
            case "updateFolderPermissions" -> doThrow(denied).when(documentService).updateFolderPermissions(eq(10L), eq(1L), any(), anyList());
            case "getStorageQuota" -> when(documentService.getStorageQuota(eq(10L), any())).thenThrow(denied);
            case "listFolders" -> when(documentService.listFolders(eq(10L), any())).thenThrow(denied);
            case "createFolder" -> when(documentService.createFolder(eq(10L), any(), any())).thenThrow(denied);
            case "deleteFolder" -> doThrow(denied).when(documentService).deleteFolder(eq(10L), eq(1L), any());
            case "listDocuments" -> when(documentService.listDocuments(eq(10L), any(), any(), anyBoolean())).thenThrow(denied);
            case "getVersions" -> when(documentService.getVersions(eq(10L), eq(1L), any())).thenThrow(denied);
            case "updateMetadata" -> when(documentService.updateMetadata(eq(10L), eq(1L), any(), any())).thenThrow(denied);
            case "softDelete" -> doThrow(denied).when(documentService).softDelete(eq(10L), eq(1L), any());
            case "restore" -> when(documentService.restore(eq(10L), eq(1L), any())).thenThrow(denied);
            case "permanentDelete" -> doThrow(denied).when(documentService).permanentDelete(eq(10L), eq(1L), any());
            case "getDownloadUrl" -> when(documentService.getDownloadUrl(eq(10L), eq(1L), any())).thenThrow(denied);
            case "initUpload" -> when(documentService.initUpload(eq(10L), any(), any())).thenThrow(denied);
            case "finalizeUpload" -> when(documentService.finalizeUpload(eq(10L), any(), any())).thenThrow(denied);
            case "uploadViaBackend" -> when(documentService.uploadDocumentViaBackend(eq(10L), any(), any(), any())).thenThrow(denied);
            default -> throw new IllegalArgumentException("Unhandled route: " + routeName);
        }

        mockMvc.perform(requestBuilder)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Permission denied"));
    }

    private static Stream<Arguments> authorizationDeniedRoutes() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        DocumentUploadInitRequestDTO init = new DocumentUploadInitRequestDTO();
        init.setFileName("spec.pdf");
        init.setContentType("application/pdf");
        init.setFileSize(50000L);

        DocumentUploadFinalizeRequestDTO finalize = new DocumentUploadFinalizeRequestDTO();
        finalize.setFileName("spec.pdf");
        finalize.setContentType("application/pdf");
        finalize.setFileSize(50000L);
        finalize.setObjectKey("project-10/root/key-spec.pdf");

        DocumentFolderCreateRequestDTO folder = new DocumentFolderCreateRequestDTO();
        folder.setName("Requirements");

        DocumentMetadataUpdateRequestDTO metadata = new DocumentMetadataUpdateRequestDTO();
        metadata.setName("renamed.pdf");

        List<FolderPermissionRequest> permissions = List.of(new FolderPermissionRequest("MEMBER", List.of("READ")));
        MockMultipartFile file = new MockMultipartFile("file", "spec.pdf", "application/pdf", "PDF".getBytes());

        return Stream.of(
                Arguments.of("getFolderPermissions", get("/api/projects/10/folders/1/permissions")),
                Arguments.of("updateFolderPermissions", put("/api/projects/10/folders/1/permissions")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(permissions))),
                Arguments.of("getStorageQuota", get("/api/projects/10/storage-quota")),
                Arguments.of("listFolders", get("/api/projects/10/folders")),
                Arguments.of("createFolder", post("/api/projects/10/folders")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(folder))),
                Arguments.of("deleteFolder", delete("/api/projects/10/folders/1").with(csrf())),
                Arguments.of("listDocuments", get("/api/projects/10/documents")),
                Arguments.of("getVersions", get("/api/projects/10/documents/1/versions")),
                Arguments.of("updateMetadata", patch("/api/projects/10/documents/1")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(metadata))),
                Arguments.of("softDelete", delete("/api/projects/10/documents/1").with(csrf())),
                Arguments.of("restore", patch("/api/projects/10/documents/1/restore").with(csrf())),
                Arguments.of("permanentDelete", delete("/api/projects/10/documents/1/permanent").with(csrf())),
                Arguments.of("getDownloadUrl", get("/api/projects/10/documents/1/download-url")),
                Arguments.of("initUpload", post("/api/projects/10/documents/upload/init")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(init))),
                Arguments.of("finalizeUpload", post("/api/projects/10/documents/upload/finalize")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(finalize))),
                Arguments.of("uploadViaBackend", multipart("/api/projects/10/documents/upload").file(file).with(csrf()))
        );
    }
}
