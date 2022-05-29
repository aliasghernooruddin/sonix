<template>
  <section>
    <v-app-bar color="primary" dark>
      <v-toolbar-title>Sonix</v-toolbar-title>
      <v-spacer></v-spacer>
      {{ error }}
    </v-app-bar>

    <v-container fluid>
      <v-row justify="center">
        <v-col cols="12" md="5">
          <v-stepper v-model="e3" vertical>
            <v-stepper-step :complete="e3 > 1" step="1"> Audio Source </v-stepper-step>

            <v-stepper-content step="1">
              <v-card outlined>
                <v-card-text>
                  <v-select v-model="selected" :items="sources" outlined></v-select>

                  <v-select
                    v-model="language"
                    item-text="text"
                    item-value="value"
                    :items="languages"
                    outlined
                  ></v-select>
                </v-card-text>
                <v-card-actions>
                  <v-btn color="primary" @click="e3 = 2"> Continue </v-btn>
                </v-card-actions>
              </v-card>
            </v-stepper-content>

            <v-stepper-step :complete="e3 > 2" step="2"> Upload Media </v-stepper-step>

            <v-stepper-content step="2">
              <v-card outlined>
                <v-card-text>
                  <vue-dropzone
                    v-if="selected == 'Upload MP3'"
                    id="vue-dropzone"
                    ref="myVueDropzone"
                    :options="dropzoneOptions"
                    :useCustomSlot="true"
                  >
                    <div class="dropzone-custom-content">
                      <h3 class="dropzone-custom-title">
                        Drag and drop to upload content!
                      </h3>
                      <div class="subtitle">
                        ...or click to select a file from your computer
                      </div>
                    </div>
                  </vue-dropzone>

                  <audio-recorder
                    v-if="selected == 'Mic Recording'"
                    :attempts="1"
                    :time="1"
                    :select-record="callback"
                    :show-upload-button="false"
                    :show-download-button="false"
                  />

                  <v-text-field
                    v-if="selected == 'Youtube URL'"
                    type="email"
                    label="Youtube URL"
                    v-model="youtube_url"
                  ></v-text-field>
                </v-card-text>

                <v-card-actions>
                  <v-btn
                    v-if="selected == 'Mic Recording'"
                    depressed
                    :disabled="media == null"
                    color="primary"
                    @click="add()"
                  >
                    Upload
                  </v-btn>
                  <v-btn
                    v-if="selected == 'Upload MP3'"
                    depressed
                    color="primary"
                    @click="add()"
                  >
                    Upload
                  </v-btn>
                  <v-btn
                    v-if="selected == 'Youtube URL'"
                    :disabled="youtube_url == ''"
                    depressed
                    color="primary"
                    @click="add()"
                  >
                    Upload
                  </v-btn>
                  <v-btn text @click="e3 = 1"> Cancel </v-btn>
                </v-card-actions>
              </v-card>
            </v-stepper-content>

            <v-stepper-step step="3"> View Results </v-stepper-step>
            <v-stepper-content step="3">
              <v-card outlined>
                <v-card-text>
                  <v-progress-circular
                    v-if="status == 'preparing' || status == 'transcribing'"
                    :size="100"
                    color="primary"
                    indeterminate
                  ></v-progress-circular>
                  <div v-if="status == 'completed'">
                    <h3>
                      Quality Score:
                      <v-chip small color="green" text-color="white">
                        {{ quality_score }}
                      </v-chip>
                    </h3>
                    {{ transcript }}
                  </div>
                  <h2 v-if="status == 'failed'">Oops....It Failed</h2>
                  <h2 v-if="status == 'duplicate'">Oops....Duplicate File Found</h2>
                </v-card-text>
                <v-card-actions>
                  <v-btn
                    v-if="status != 'preparing' && status != 'transcribing'"
                    text
                    @click="e3 = 1"
                  >
                    Close
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-stepper-content>
          </v-stepper>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script>
import AWS from "aws-sdk";
import vue2Dropzone from "vue2-dropzone";
import "vue2-dropzone/dist/vue2Dropzone.min.css";

var bucketName = "sonix-s3";
var bucketRegion = "us-east-1";
var ACCESS_KEY = "";
var SECRET_KEY = "";
var SONIX_API_KEY = "";

AWS.config.update({
  region: bucketRegion,
});

var s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_KEY,
  params: {
    Bucket: bucketName,
  },
});

var HEADERS = {
  headers: {
    Authorization: "Bearer " + SONIX_API_KEY,
  },
};

var BASE_URL = "https://api.sonix.ai/v1/media";

export default {
  name: "HomeView",
  components: {
    vueDropzone: vue2Dropzone,
  },
  data() {
    return {
      e3: 1,
      dropzoneOptions: {
        url: "https://dummy.com",
        autoProcessQueue: false,
        thumbnailWidth: 150,
        addRemoveLinks: true,
      },
      sources: ["Mic Recording", "Upload MP3", "Youtube URL"],
      selected: "Youtube URL",
      languages: [
        {
          value: "en",
          text: "English",
        },
        {
          value: "fr",
          text: "French",
        },
      ],
      language: "en",
      youtube_url: null,
      media: null,
      error: null,
      status: null,
      interval: null,
      transcript: null,
      quality_score: null,
    };
  },
  methods: {
    callback(blob) {
      var file = new File([blob], "filename");
      this.media = file;
    },
    add() {
      if (this.selected == "Mic Recording") {
        this.s3Upload();
      } else if (this.selected == "Upload MP3") {
        this.media = this.$refs.myVueDropzone.getAcceptedFiles()[0];
        this.s3Upload();
      } else {
        this.uploadToSonix(this.youtube_url);
      }
    },
    s3Upload() {
      let fileName = this.media.name;
      let obj = {
        Key: fileName,
        Body: this.media,
        ACL: "public-read",
      };

      let self = this;
      s3.upload(obj, function (err, data) {
        if (err) {
          self.error = err.message;
        }
        if (data) {
          self.uploadToSonix(data.Location);
          console.log(data);
        }
      });
    },
    uploadToSonix(file_url) {
      let data = {
        file_url: file_url,
        language: this.language,
      };

      this.$http
        .post(BASE_URL, data, HEADERS)
        .then((result) => {
          this.e3 = 3;
          this.checkStatus(result.data.id);
          this.status = result.data.status;
        })
        .catch((err) => {
          this.error = err.response;
        });
    },
    checkStatus(id) {
      let self = this;
      this.interval = setInterval(function () {
        self.$http
          .get(BASE_URL + "/" + id, HEADERS)
          .then((result) => {
            self.status = result.data.status;
            if (self.status == "failed" || self.status == "duplicate") {
              clearInterval(self.interval);
            }
            if (self.status == "completed") {
              clearInterval(self.interval);
              self.getTranscript(id);
              self.quality_score = result.data.quality_score;
            }
          })
          .catch((err) => {
            self.error = err.response;
          });
      }, 10000);
    },
    getTranscript(id) {
      this.$http
        .get(BASE_URL + "/" + id + "/transcript", HEADERS)
        .then((result) => {
          this.transcript = result.data;
        })
        .catch((err) => {
          this.error = err.response;
        });
    },
  },
};
</script>

<style>
.dropzone-custom-content {
  text-align: center;
}

.dropzone-custom-title {
  color: #00b782;
}

.subtitle {
  color: #314b5f;
}
</style>
